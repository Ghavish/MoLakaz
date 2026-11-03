// Stand-ins for things the backend doesn't do yet. Each has a TODO naming the endpoint it should call.
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// TODO: POST /households/{id}/tasks/{tid}/retake { member_id } -> notify the member to retake the photo
export async function askForRetake(): Promise<void> {
  await wait(400);
}

// TODO: POST /households/{id}/tasks/{tid}/review { member_id } -> add the chore to the admin's Approvals
export async function askAdminToCheck(): Promise<void> {
  await wait(400);
}
