import IssuedResidentDocument from './IssuedResidentDocument';

export default async function IssuedResidentDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <IssuedResidentDocument requestId={id} />;
}
