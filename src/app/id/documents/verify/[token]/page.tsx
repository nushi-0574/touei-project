import VerifyResidentDocument from './VerifyResidentDocument';

export default async function VerifyResidentDocumentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <VerifyResidentDocument token={token} />;
}
