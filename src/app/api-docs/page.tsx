import type { Metadata } from "next";

import { SwaggerDocs } from "./swagger-ui";

export const metadata: Metadata = {
  title: "Documentation API | TdT",
  description: "Contrat OpenAPI de l'API TdT",
};

export default function ApiDocsPage() {
  return (
    <main>
      <h1>Documentation de l&apos;API TdT</h1>
      <p>
        Les opérations indiquées comme planifiées décrivent le contrat cible et
        ne sont pas encore disponibles.
      </p>
      <SwaggerDocs />
    </main>
  );
}
