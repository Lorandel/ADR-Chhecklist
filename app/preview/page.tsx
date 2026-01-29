import PreviewClient from "./preview-client"

export default function PreviewPage({ searchParams }: { searchParams: { id?: string } }) {
  const id = searchParams?.id || ""
  return <PreviewClient id={id} />
}
