export type ClientShareContour = "order" | "group";

export type ClientShareDecision = {
  changed: boolean;
  confirm: boolean;
  message: string | null;
};

export function clientCreateAllowed(status: number | null): boolean {
  if (status == null) return true;
  return status !== 401 && status !== 403;
}

export function clientShareDecision(input: {
  savedClientId: number | null;
  nextClientId: number | null;
  siblingCount: number | null;
  contour: ClientShareContour;
}): ClientShareDecision {
  const changed = input.nextClientId !== input.savedClientId;
  if (!changed) return { changed: false, confirm: false, message: null };
  const many = input.siblingCount != null && input.siblingCount > 1;
  const unknown = input.siblingCount == null;
  const scope =
    input.contour === "order" ? "заказа и всех его техкарт" : "всех техкарт этой группы";
  if (unknown) {
    return {
      changed: true,
      confirm: true,
      message: `Не удалось проверить число техкарт. Смена контрагента запишется для ${scope}.`,
    };
  }
  if (many) {
    const where = input.contour === "order" ? "этого заказа" : "этой группы";
    return {
      changed: true,
      confirm: true,
      message: `Контрагент общий: изменение затронет ${input.siblingCount} техкарт ${where}.`,
    };
  }
  if (input.siblingCount === 0) return { changed: true, confirm: false, message: null };
  return {
    changed: true,
    confirm: false,
    message:
      input.contour === "order"
        ? "Контрагент хранится у заказа."
        : "Контрагент хранится у группы техкарт.",
  };
}
