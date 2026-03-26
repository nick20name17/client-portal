import { ProjectViewer } from "@/components/viewer/ProjectViewer";

export default async function ViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectViewer projectId={id} />;
}
