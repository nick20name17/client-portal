import { createFileRoute } from "@tanstack/react-router";

import { ProjectViewer } from "@/components/viewer/ProjectViewer";

export const Route = createFileRoute("/_authenticated/projects/$id/viewer/")({
  component: ViewerPage,
});

function ViewerPage() {
  const { id } = Route.useParams();
  return <ProjectViewer projectId={id} />;
}
