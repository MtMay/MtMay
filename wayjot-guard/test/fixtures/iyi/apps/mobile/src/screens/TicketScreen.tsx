import { usePreventScreenCapture } from 'expo-screen-capture';
const Params = z.object({ id: z.string().uuid() }).strict();
export default function TicketScreen() {
  usePreventScreenCapture();
  const parsed = Params.safeParse(useLocalSearchParams());
  return parsed.success ? <Ticket id={parsed.data.id} /> : null;
}
