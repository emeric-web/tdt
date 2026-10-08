import type { Metadata } from "next";
import "swagger-ui-react/swagger-ui.css";
import { SwaggerDocs } from "./swagger-ui";

export const metadata: Metadata = {
  title: "Documentation API | TdT",
  description: "Contrat OpenAPI de l'API TdT",
};

export default function ApiDocsPage() {
  return (
    <main>
      <SwaggerDocs />
    </main>
  );
}
