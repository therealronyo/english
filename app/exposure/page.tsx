import type { Metadata } from "next";
import GraphExplorer from "./components/GraphExplorer";

export const metadata: Metadata = {
  title: "ExposureGraph — Organization Exposure Management",
  description:
    "Interactive prototype: explore your organization's attack surface as a graph, from clustered bird's-eye view down to individual entities and attack paths.",
};

export default function ExposurePage() {
  return <GraphExplorer />;
}
