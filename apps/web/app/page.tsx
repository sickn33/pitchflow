import { Workspace } from "../components/workspace";
import { isPublicViewer } from "../lib/runtime";

export default function HomePage() {
  return <Workspace publicViewer={isPublicViewer()} />;
}
