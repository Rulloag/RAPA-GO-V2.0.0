export function canUsePassengerProfile(role: string): boolean {
  return role === "passenger" || role === "driver";
}
