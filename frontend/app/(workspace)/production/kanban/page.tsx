import { redirect } from "next/navigation";

export default function ProductionShopKanbanPage() {
  redirect("/production/tech-cards?view=kanban");
}
