from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import EmailStr
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.sales import Lead, LeadEvent, LeadEventType, LeadResult, LeadStatus, SalesUser
from app.schemas.sales import (
    LeadConversionRead,
    LeadContactCreate,
    LeadContactRead,
    LeadContactUpdate,
    LeadCreate,
    LeadConvertRequest,
    LeadEventRead,
    LeadRead,
    LeadRejectRequest,
    LeadTaskCompleteRequest,
    LeadTaskCreate,
    LeadTaskRead,
    LeadTaskUpdate,
    LeadNoteCreate,
    LeadNoteRead,
    LeadNoteUpdate,
    LeadMessageCreate,
    LeadMessageRead,
    LeadUpdate,
)
from app.services.lead_creation import LeadResponsibleNotFoundError, create_lead
from app.services.lead_contacts import (
    LeadContactNotFoundError,
    LeadNotFoundError as ContactLeadNotFoundError,
    PrimaryLeadContactDeletionError,
    create_lead_contact,
    delete_lead_contact,
    set_primary_lead_contact,
    update_lead_contact,
)
from app.services.lead_conversion import (
    LeadAlreadyCompletedError,
    LeadNotFoundError,
    RejectionReasonError,
    convert_lead,
    reject_lead,
)
from app.services.lead_duplicates import LeadDuplicateCriteriaError, find_duplicate_leads
from app.services.lead_messages import (
    LeadMessageAuthorNotFoundError,
    LeadNotFoundError as MessageLeadNotFoundError,
    create_lead_message,
    list_lead_messages,
    to_lead_message_read,
)
from app.services.lead_notes import (
    LeadNotFoundError as NoteLeadNotFoundError,
    LeadNoteAuthorNotFoundError,
    LeadNoteNotFoundError,
    create_lead_note,
    delete_lead_note,
    list_lead_notes,
    to_lead_note_read,
    toggle_lead_note_pin,
    update_lead_note,
)
from app.services.lead_stages import (
    LeadStageConflictError,
    LeadStageNotFoundError,
    change_lead_stage,
)
from app.services.lead_tasks import (
    LeadNotFoundError as TaskLeadNotFoundError,
    LeadTaskAssigneeNotFoundError,
    LeadTaskNotFoundError,
    LeadTaskStateError,
    complete_lead_task,
    create_lead_task,
    delete_lead_task,
    list_lead_tasks,
    reopen_lead_task,
    to_lead_task_read,
    update_lead_task,
)

router = APIRouter(prefix="/leads", tags=["Sales leads"])


def _contact_http_error(error: Exception) -> HTTPException:
    if isinstance(error, (ContactLeadNotFoundError, LeadContactNotFoundError)):
        return HTTPException(status_code=404, detail=str(error))
    return HTTPException(status_code=409, detail=str(error))


def _task_http_error(error: Exception) -> HTTPException:
    if isinstance(error, (TaskLeadNotFoundError, LeadTaskNotFoundError, LeadTaskAssigneeNotFoundError)):
        return HTTPException(status_code=404, detail=str(error))
    if isinstance(error, LeadTaskStateError):
        return HTTPException(status_code=409, detail=str(error))
    return HTTPException(status_code=409, detail=str(error))


def _note_http_error(error: Exception) -> HTTPException:
    if isinstance(error, (NoteLeadNotFoundError, LeadNoteNotFoundError, LeadNoteAuthorNotFoundError)):
        return HTTPException(status_code=404, detail=str(error))
    return HTTPException(status_code=409, detail=str(error))


def _message_http_error(error: Exception) -> HTTPException:
    if isinstance(error, (MessageLeadNotFoundError, LeadMessageAuthorNotFoundError)):
        return HTTPException(status_code=404, detail=str(error))
    return HTTPException(status_code=409, detail=str(error))


@router.post("", response_model=LeadRead, status_code=status.HTTP_201_CREATED)
def create_lead_endpoint(payload: LeadCreate, db: Session = Depends(get_db)) -> LeadRead:
    try:
        lead = create_lead(db, payload)
        db.commit()
    except LeadResponsibleNotFoundError as error:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(error)) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Lead could not be created") from error
    db.refresh(lead)
    return LeadRead.model_validate(lead)


@router.get("", response_model=list[LeadRead])
def list_leads(
    result: LeadResult | None = None,
    active: bool | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[Lead]:
    statement = select(Lead)
    if result is not None:
        statement = statement.where(Lead.result == result)
    if active is True:
        statement = statement.where(Lead.status != LeadStatus.COMPLETED.value)
    elif active is False:
        statement = statement.where(Lead.status == LeadStatus.COMPLETED.value)
    statement = statement.order_by(Lead.created_at.desc(), Lead.id.desc()).offset(offset).limit(limit)
    return list(db.scalars(statement).all())


@router.get("/duplicate-candidates", response_model=list[LeadRead])
def find_duplicate_lead_candidates(
    phone: str | None = Query(default=None, max_length=50),
    email: EmailStr | None = None,
    exclude_lead_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
) -> list[Lead]:
    try:
        return find_duplicate_leads(
            db,
            phone=phone,
            email=str(email) if email is not None else None,
            exclude_lead_id=exclude_lead_id,
            limit=limit,
        )
    except LeadDuplicateCriteriaError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/{lead_id}", response_model=LeadRead)
def get_lead(lead_id: int, db: Session = Depends(get_db)) -> Lead:
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.patch("/{lead_id}", response_model=LeadRead)
def update_lead(lead_id: int, payload: LeadUpdate, db: Session = Depends(get_db)) -> Lead:
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.status == LeadStatus.COMPLETED.value:
        raise HTTPException(status_code=409, detail="Completed leads cannot be changed")
    changes = payload.model_dump(exclude_unset=True)
    requested_stage = changes.pop("status", None)
    requested_responsible_id = changes.get("responsible_id")
    if requested_responsible_id is not None:
        responsible = db.get(SalesUser, requested_responsible_id)
        if responsible is None or not responsible.is_active:
            raise HTTPException(status_code=404, detail="Active responsible user not found")
    for field_name, value in changes.items():
        setattr(lead, field_name, value)
    if requested_stage is not None:
        try:
            change_lead_stage(db, lead, requested_stage)
        except LeadStageNotFoundError as error:
            db.rollback()
            raise HTTPException(status_code=404, detail=str(error)) from error
        except LeadStageConflictError as error:
            db.rollback()
            raise HTTPException(status_code=409, detail=str(error)) from error
    db.commit()
    db.refresh(lead)
    return lead


@router.post(
    "/{lead_id}/contacts",
    response_model=LeadContactRead,
    status_code=status.HTTP_201_CREATED,
)
def create_contact_endpoint(
    lead_id: int,
    payload: LeadContactCreate,
    db: Session = Depends(get_db),
) -> LeadContactRead:
    try:
        contact = create_lead_contact(db, lead_id, payload)
        db.commit()
    except (ContactLeadNotFoundError, LeadContactNotFoundError) as error:
        db.rollback()
        raise _contact_http_error(error) from error
    db.refresh(contact)
    return LeadContactRead.model_validate(contact)


@router.patch(
    "/{lead_id}/contacts/{contact_id}",
    response_model=LeadContactRead,
)
def update_contact_endpoint(
    lead_id: int,
    contact_id: int,
    payload: LeadContactUpdate,
    db: Session = Depends(get_db),
) -> LeadContactRead:
    try:
        contact = update_lead_contact(db, lead_id, contact_id, payload)
        db.commit()
    except (ContactLeadNotFoundError, LeadContactNotFoundError) as error:
        db.rollback()
        raise _contact_http_error(error) from error
    db.refresh(contact)
    return LeadContactRead.model_validate(contact)


@router.post(
    "/{lead_id}/contacts/{contact_id}/set-primary",
    response_model=LeadContactRead,
)
def set_primary_contact_endpoint(
    lead_id: int,
    contact_id: int,
    db: Session = Depends(get_db),
) -> LeadContactRead:
    try:
        contact = set_primary_lead_contact(db, lead_id, contact_id)
        db.commit()
    except (ContactLeadNotFoundError, LeadContactNotFoundError) as error:
        db.rollback()
        raise _contact_http_error(error) from error
    db.refresh(contact)
    return LeadContactRead.model_validate(contact)


@router.delete(
    "/{lead_id}/contacts/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_contact_endpoint(
    lead_id: int,
    contact_id: int,
    db: Session = Depends(get_db),
) -> Response:
    try:
        delete_lead_contact(db, lead_id, contact_id)
        db.commit()
    except (
        ContactLeadNotFoundError,
        LeadContactNotFoundError,
        PrimaryLeadContactDeletionError,
    ) as error:
        db.rollback()
        raise _contact_http_error(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{lead_id}/convert", response_model=LeadConversionRead, status_code=201)
def convert_lead_endpoint(
    lead_id: int,
    payload: LeadConvertRequest,
    db: Session = Depends(get_db),
) -> LeadConversionRead:
    try:
        lead, order = convert_lead(db, lead_id, payload)
        db.commit()
    except LeadNotFoundError as error:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(error)) from error
    except LeadAlreadyCompletedError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(error)) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Lead conversion conflict") from error
    db.refresh(lead)
    db.refresh(order)
    return LeadConversionRead(lead=LeadRead.model_validate(lead), order=order)


@router.post("/{lead_id}/reject", response_model=LeadRead)
def reject_lead_endpoint(
    lead_id: int,
    payload: LeadRejectRequest,
    db: Session = Depends(get_db),
) -> Lead:
    try:
        lead = reject_lead(db, lead_id, payload)
        db.commit()
    except LeadNotFoundError as error:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(error)) from error
    except (LeadAlreadyCompletedError, RejectionReasonError) as error:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(error)) from error
    db.refresh(lead)
    return lead


@router.get("/{lead_id}/history", response_model=list[LeadEventRead])
def get_lead_history(lead_id: int, db: Session = Depends(get_db)) -> list[LeadEvent]:
    if db.get(Lead, lead_id) is None:
        raise HTTPException(status_code=404, detail="Lead not found")
    return list(
        db.scalars(
            select(LeadEvent)
            .where(LeadEvent.lead_id == lead_id)
            .order_by(LeadEvent.created_at, LeadEvent.id)
        ).all()
    )


@router.get("/{lead_id}/tasks", response_model=list[LeadTaskRead])
def list_tasks_endpoint(lead_id: int, db: Session = Depends(get_db)) -> list[LeadTaskRead]:
    try:
        tasks = list_lead_tasks(db, lead_id)
    except TaskLeadNotFoundError as error:
        raise _task_http_error(error) from error
    return [to_lead_task_read(db, task) for task in tasks]


@router.post("/{lead_id}/tasks", response_model=LeadTaskRead, status_code=status.HTTP_201_CREATED)
def create_task_endpoint(
    lead_id: int,
    payload: LeadTaskCreate,
    db: Session = Depends(get_db),
) -> LeadTaskRead:
    try:
        task = create_lead_task(db, lead_id, payload)
        db.commit()
    except (TaskLeadNotFoundError, LeadTaskAssigneeNotFoundError) as error:
        db.rollback()
        raise _task_http_error(error) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Lead task could not be created") from error
    db.refresh(task)
    return to_lead_task_read(db, task)


@router.patch("/{lead_id}/tasks/{task_id}", response_model=LeadTaskRead)
def update_task_endpoint(
    lead_id: int,
    task_id: int,
    payload: LeadTaskUpdate,
    db: Session = Depends(get_db),
) -> LeadTaskRead:
    try:
        task = update_lead_task(db, lead_id, task_id, payload)
        db.commit()
    except (TaskLeadNotFoundError, LeadTaskNotFoundError, LeadTaskAssigneeNotFoundError) as error:
        db.rollback()
        raise _task_http_error(error) from error
    db.refresh(task)
    return to_lead_task_read(db, task)


@router.post("/{lead_id}/tasks/{task_id}/complete", response_model=LeadTaskRead)
def complete_task_endpoint(
    lead_id: int,
    task_id: int,
    payload: LeadTaskCompleteRequest,
    db: Session = Depends(get_db),
) -> LeadTaskRead:
    try:
        task = complete_lead_task(db, lead_id, task_id, payload)
        db.commit()
    except (TaskLeadNotFoundError, LeadTaskNotFoundError, LeadTaskStateError) as error:
        db.rollback()
        raise _task_http_error(error) from error
    db.refresh(task)
    return to_lead_task_read(db, task)


@router.post("/{lead_id}/tasks/{task_id}/reopen", response_model=LeadTaskRead)
def reopen_task_endpoint(
    lead_id: int,
    task_id: int,
    db: Session = Depends(get_db),
) -> LeadTaskRead:
    try:
        task = reopen_lead_task(db, lead_id, task_id)
        db.commit()
    except (TaskLeadNotFoundError, LeadTaskNotFoundError, LeadTaskStateError) as error:
        db.rollback()
        raise _task_http_error(error) from error
    db.refresh(task)
    return to_lead_task_read(db, task)


@router.delete(
    "/{lead_id}/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_task_endpoint(
    lead_id: int,
    task_id: int,
    db: Session = Depends(get_db),
) -> Response:
    try:
        delete_lead_task(db, lead_id, task_id)
        db.commit()
    except (TaskLeadNotFoundError, LeadTaskNotFoundError) as error:
        db.rollback()
        raise _task_http_error(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{lead_id}/notes", response_model=list[LeadNoteRead])
def list_notes_endpoint(lead_id: int, db: Session = Depends(get_db)) -> list[LeadNoteRead]:
    try:
        notes = list_lead_notes(db, lead_id)
    except NoteLeadNotFoundError as error:
        raise _note_http_error(error) from error
    return [to_lead_note_read(db, note) for note in notes]


@router.post("/{lead_id}/notes", response_model=LeadNoteRead, status_code=status.HTTP_201_CREATED)
def create_note_endpoint(
    lead_id: int,
    payload: LeadNoteCreate,
    db: Session = Depends(get_db),
) -> LeadNoteRead:
    try:
        note = create_lead_note(db, lead_id, payload)
        db.commit()
    except (NoteLeadNotFoundError, LeadNoteAuthorNotFoundError) as error:
        db.rollback()
        raise _note_http_error(error) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Lead note could not be created") from error
    db.refresh(note)
    return to_lead_note_read(db, note)


@router.patch("/{lead_id}/notes/{note_id}", response_model=LeadNoteRead)
def update_note_endpoint(
    lead_id: int,
    note_id: int,
    payload: LeadNoteUpdate,
    db: Session = Depends(get_db),
) -> LeadNoteRead:
    try:
        note = update_lead_note(db, lead_id, note_id, payload)
        db.commit()
    except (NoteLeadNotFoundError, LeadNoteNotFoundError, LeadNoteAuthorNotFoundError) as error:
        db.rollback()
        raise _note_http_error(error) from error
    db.refresh(note)
    return to_lead_note_read(db, note)


@router.post("/{lead_id}/notes/{note_id}/toggle-pin", response_model=LeadNoteRead)
def toggle_note_pin_endpoint(
    lead_id: int,
    note_id: int,
    db: Session = Depends(get_db),
) -> LeadNoteRead:
    try:
        note = toggle_lead_note_pin(db, lead_id, note_id)
        db.commit()
    except (NoteLeadNotFoundError, LeadNoteNotFoundError) as error:
        db.rollback()
        raise _note_http_error(error) from error
    db.refresh(note)
    return to_lead_note_read(db, note)


@router.delete(
    "/{lead_id}/notes/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_note_endpoint(
    lead_id: int,
    note_id: int,
    db: Session = Depends(get_db),
) -> Response:
    try:
        delete_lead_note(db, lead_id, note_id)
        db.commit()
    except (NoteLeadNotFoundError, LeadNoteNotFoundError) as error:
        db.rollback()
        raise _note_http_error(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{lead_id}/messages", response_model=list[LeadMessageRead])
def list_messages_endpoint(lead_id: int, db: Session = Depends(get_db)) -> list[LeadMessageRead]:
    try:
        messages = list_lead_messages(db, lead_id)
    except MessageLeadNotFoundError as error:
        raise _message_http_error(error) from error
    return [to_lead_message_read(db, message) for message in messages]


@router.post(
    "/{lead_id}/messages",
    response_model=LeadMessageRead,
    status_code=status.HTTP_201_CREATED,
)
def create_message_endpoint(
    lead_id: int,
    payload: LeadMessageCreate,
    db: Session = Depends(get_db),
) -> LeadMessageRead:
    try:
        message = create_lead_message(db, lead_id, payload)
        db.commit()
    except (MessageLeadNotFoundError, LeadMessageAuthorNotFoundError) as error:
        db.rollback()
        raise _message_http_error(error) from error
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Lead message could not be created") from error
    db.refresh(message)
    return to_lead_message_read(db, message)
