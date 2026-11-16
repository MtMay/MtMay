export function ShareCard({ trip }) {
  return <Pressable onPress={go}><Text style={{ color: '#FF0000' }}>{trip.pnr} {trip.city.toUpperCase()}</Text></Pressable>;
}
