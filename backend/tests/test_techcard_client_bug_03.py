"""BUG-03A: live Client identity shared by parent-owned technical cards."""

from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.sales import SalesOrder, SalesUser
from app.models.technical_card import TechnicalCard, TechnicalCardOrderGroup
from app.services.tech_card_client import technical_card_clients
from tests.auth_test_helpers import ensure_user_with_role, login_client
from tests.test_production_scheduler_pc_04_3a import scheduler, run
from tests.test_manual_route_replan_pc_06_3b import snapshot
from app.models.sales import Client
from app.services.tech_card_client import update_technical_card_client


@pytest.fixture
def workspace():
    engine = create_engine('sqlite+pysqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)

    @event.listens_for(engine, 'connect')
    def foreign_keys(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')

    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        db.add(SalesUser(id=1, name='Manager'))
        db.flush()
        product = Nomenclature(name='BUG-03', category='Форма', nomenclature_type=NomenclatureType.PRODUCT,
                               unit='шт', base_price=Decimal('10'))
        db.add(product)
        ensure_user_with_role(db, login='bug03', display_name='Manager', role_code='admin')
        db.commit()
        product_id = product.id

    def session():
        with factory() as db:
            yield db

    previous = dict(app.dependency_overrides)
    app.dependency_overrides[get_db] = session
    try:
        with TestClient(app) as api:
            login_client(api, login='bug03')
            yield api, factory, engine, product_id
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def create_client(api, company='Club'):
    response = api.post('/clients', json={'contact_name': 'Contact', 'company_name': company})
    assert response.status_code == 201, response.text
    return response.json()['id']


def create_standalone(api, product_id, number='BUG-03'):
    response = api.post('/technical-cards/standalone', json={
        'nomenclature_id': product_id, 'order_number': number,
        'tech_cards_planned_count': 3, 'quantity': 2, 'desired_date': '2026-11-21',
    })
    assert response.status_code == 201, response.text
    return response.json()


def order_cards(api, product_id, client_id):
    order = api.post('/orders', json={'client_id': client_id, 'responsible_id': 1, 'title': 'BUG-03'})
    assert order.status_code == 201, order.text
    order_id = order.json()['id']
    for _ in range(2):
        item = api.post(f'/orders/{order_id}/items', json={
            'nomenclature_id': product_id, 'snapshot_name': 'BUG-03', 'quantity': '2', 'unit_price': '10',
        })
        assert item.status_code == 201, item.text
    response = api.post(f'/orders/{order_id}/technical-cards/generate')
    assert response.status_code == 201, response.text
    assert len(response.json()['created']) == 2
    return order_id, [row['id'] for row in response.json()['created']]


def assert_cards(api, ids, client_id, name, order_id=None):
    for card_id in ids:
        detail = api.get(f'/technical-cards/{card_id}')
        assert detail.status_code == 200, detail.text
        assert (detail.json()['client_id'], detail.json()['client_name']) == (client_id, name)
    paths = ['/technical-cards']
    if order_id is not None:
        paths.append(f'/orders/{order_id}/technical-cards')
        order = api.get(f'/orders/{order_id}').json()
        assert (order['client_id'], order['client_name']) == (client_id, name)
    for path in paths:
        response = api.get(path)
        assert response.status_code == 200, response.text
        found = [row for row in response.json() if row['id'] in ids]
        assert len(found) == len(ids)
        for row in found:
            assert (row['client_id'], row['client_name']) == (client_id, name)
            assert 'composition_lines' not in row and 'unit_lines' not in row


def test_standalone_group_selection_create_rename_reload_and_clear(workspace):
    api, factory, _, product = workspace
    first = create_standalone(api, product)
    second = create_standalone(api, product)
    unrelated = create_standalone(api, product, 'OTHER')
    ids = [first['id'], second['id']]
    assert first['order_group_id'] == second['order_group_id']
    selected = create_client(api)
    changed = api.patch(f"/technical-cards/{first['id']}/client", json={'client_id': selected})
    assert changed.status_code == 200, changed.text
    assert_cards(api, ids, selected, 'Club')
    third = create_standalone(api, product)
    ids.append(third['id'])
    assert (third['client_id'], third['client_name']) == (selected, 'Club')
    with factory() as db:
        assert db.get(TechnicalCardOrderGroup, first['order_group_id']).client_id == selected
        assert 'client_id' not in TechnicalCard.__table__.columns
    renamed = api.patch(f'/clients/{selected}', json={'company_name': '  New Club  ', 'contact_name': ' New Contact '})
    assert renamed.status_code == 200, renamed.text
    assert_cards(api, ids, selected, 'New Club')
    assert api.patch(f'/clients/{selected}', json={'company_name': '  '}).status_code == 200
    assert_cards(api, ids, selected, 'New Contact')
    replacement = create_client(api, 'Replacement')
    assert api.patch(f"/technical-cards/{second['id']}/client", json={'client_id': replacement}).status_code == 200
    assert_cards(api, ids, replacement, 'Replacement')
    assert_cards(api, [unrelated['id']], None, None)
    assert api.patch(f"/technical-cards/{first['id']}/client", json={'client_id': None}).status_code == 200
    assert_cards(api, ids, None, None)


def test_order_inheritance_both_mutation_surfaces_and_document_preservation(workspace):
    api, factory, _, product = workspace
    original = create_client(api)
    order_id, ids = order_cards(api, product, original)
    assert_cards(api, ids, original, 'Club', order_id)
    quotation = api.post(f'/orders/{order_id}/quotations')
    invoice = api.post(f'/orders/{order_id}/invoices')
    assert quotation.status_code == invoice.status_code == 201
    paths = [f'/orders/{order_id}/quotations', f'/orders/{order_id}/invoices']
    documents_before = [api.get(path).json() for path in paths]
    replacement = create_client(api, 'Replacement')
    assert api.patch(f'/technical-cards/{ids[0]}/client', json={'client_id': replacement}).status_code == 200
    assert_cards(api, ids, replacement, 'Replacement', order_id)
    assert api.patch(f'/clients/{replacement}', json={'company_name': 'Renamed'}).status_code == 200
    assert_cards(api, ids, replacement, 'Renamed', order_id)
    changed = api.patch(f'/orders/{order_id}/client', json={'client_id': original})
    assert changed.status_code == 200, changed.text
    assert_cards(api, ids, original, 'Club', order_id)
    assert [api.get(path).json() for path in paths] == documents_before
    assert api.patch(f'/technical-cards/{ids[0]}/client', json={'client_id': None}).status_code == 422
    assert_cards(api, ids, original, 'Club', order_id)
    with factory() as db:
        assert db.get(SalesOrder, order_id).client_id == original


@pytest.mark.parametrize('payload', [{}, {'client_id': 0}, {'client_id': -1}])
def test_binding_requires_explicit_valid_id_or_null(workspace, payload):
    api, _, _, product = workspace
    card = create_standalone(api, product)
    assert api.patch(f"/technical-cards/{card['id']}/client", json=payload).status_code == 422


@pytest.mark.parametrize('value', [None, '', '   '])
def test_rename_rejects_empty_required_contact(workspace, value):
    api, _, _, _ = workspace
    client_id = create_client(api)
    assert api.patch(f'/clients/{client_id}', json={'contact_name': value}).status_code == 422
    assert api.get(f'/clients/{client_id}').json()['contact_name'] == 'Contact'


def test_binding_not_found_unauthorized_and_cancelled(workspace):
    api, factory, _, product = workspace
    card = create_standalone(api, product)
    client_id = create_client(api)
    path = f"/technical-cards/{card['id']}/client"
    assert api.patch(path, json={'client_id': 999999}).status_code == 404
    assert api.patch('/technical-cards/999999/client', json={'client_id': client_id}).status_code == 404
    assert api.patch('/clients/999999', json={'company_name': 'Missing'}).status_code == 404
    with TestClient(app) as anonymous:
        assert anonymous.patch(path, json={'client_id': client_id}).status_code == 401
    with factory() as db:
        db.get(TechnicalCard, card['id']).status = 'cancelled'
        db.commit()
    assert api.patch(path, json={'client_id': client_id}).status_code == 422
    assert_cards(api, [card['id']], None, None)


def test_parent_client_batch_is_one_read_query_for_many_cards(workspace):
    api, factory, engine, product = workspace
    client_id = create_client(api)
    cards = [create_standalone(api, product) for _ in range(3)]
    assert api.patch(f"/technical-cards/{cards[0]['id']}/client", json={'client_id': client_id}).status_code == 200
    statements = []

    def observe(conn, cursor, sql, *args):
        statements.append(sql)

    with factory() as db:
        for ids in [[cards[0]['id']], [card['id'] for card in cards]]:
            statements.clear()
            event.listen(engine, 'before_cursor_execute', observe)
            try:
                resolved = technical_card_clients(db, ids)
            finally:
                event.remove(engine, 'before_cursor_execute', observe)
            assert resolved == {card_id: (client_id, 'Club') for card_id in ids}
            assert len(statements) == 1 and statements[0].lstrip().upper().startswith('SELECT')
        assert technical_card_clients(db, []) == {}


def test_runtime_registry_keeps_contractors_planned(workspace):
    api, _, _, _ = workspace
    registry = api.get('/platform-directories')
    assert registry.status_code == 200, registry.text
    contractors = next(row for row in registry.json() if row['code'] == 'contractors')
    assert contractors['status'] == 'planned' and contractors['api_prefix'] == ''
    assert api.get('/contractors').status_code == 404


def test_client_selection_preserves_protected_production_fact_and_plan(scheduler):
    factory, _ = scheduler
    run(factory)
    with factory() as db:
        client = Client(contact_name='BUG-03')
        db.add(client)
        card = db.get(TechnicalCard, 1)
        card.plan_locked = True
        card.stage_results[0].status = 'in_progress'
        db.commit()
        before = snapshot(db)
        update_technical_card_client(db, 1, client_id=client.id)
        db.commit()
        assert snapshot(db) == before
        assert db.get(TechnicalCardOrderGroup, card.order_group_id).client_id == client.id
