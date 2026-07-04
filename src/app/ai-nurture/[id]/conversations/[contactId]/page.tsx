import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ id: string; contactId: string }>;
};

export default async function AiConversationRedirectPage({ params }: Props) {
  const { id, contactId } = await params;
  redirect(`/inbox/${contactId}/${id}`);
}
