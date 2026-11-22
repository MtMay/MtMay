export default function TicketScreen() {
  const { id } = useLocalSearchParams();
  useEffect(() => { deleteTrip(id); }, [id]);
  return null;
}
