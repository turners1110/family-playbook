import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Legacy route — essentials live at /questions/before-birth. */
export default function BeforeBirthRedirectPage() {
  redirect("/questions/before-birth");
}
