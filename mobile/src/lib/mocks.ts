// Stand-ins for things the backend doesn't do yet. Each has a TODO naming the endpoint it should call.
import type { Household } from './types';

export type ActionSummary = {
  moved?: string;
  added?: string;
  fairness?: { from: number; to: number };
};

export type AssistantReply = { text: string; action?: ActionSummary };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function name(hh: Household, i: number) {
  return hh.members[i % Math.max(hh.members.length, 1)]?.name ?? 'someone';
}

// TODO: POST /households/{id}/assistant { member_id, text } -> { reply, changes, household }
// Muse Spark with tools (move chore, swap, add note, explain week). Until then this fakes a reply.
export async function assistantSend(hh: Household, me: string, text: string): Promise<AssistantReply> {
  await wait(900);
  const t = text.toLowerCase();
  const fair = Math.round(hh.fairness * 100);
  const other = hh.members.find((m) => m.id !== me);
  const chore = hh.chores[0]?.name ?? 'a chore';
  if (/busy|study|exam|can't|cannot|move|take my/.test(t)) {
    return {
      text: `Done. ${other?.name ?? 'Someone'} has time free, so they're taking "${chore}" today. I gave you a lighter job later in the week so it stays even.`,
      action: {
        moved: `${chore} (today) · you → ${other?.name ?? 'someone'}`,
        added: `${hh.chores[1]?.name ?? 'A chore'} (later) → you`,
        fairness: { from: fair, to: Math.max(fair - 1, 0) },
      },
    };
  }
  if (/left|today/.test(t)) {
    const left = hh.tasks.filter((x) => x.member === me && x.day === hh.today && x.status !== 'done').length;
    return { text: left ? `You've got ${left} chore${left > 1 ? 's' : ''} left today.` : "Nothing left for you today. Enjoy!" };
  }
  if (/swap/.test(t)) {
    return { text: `Which chore would you like to swap? Say something like "swap my dishes with ${name(hh, 1)}".` };
  }
  if (/note/.test(t)) {
    return { text: 'Got it, I added that to the notes the planner reads next week.' };
  }
  if (/who|tomorrow/.test(t)) {
    const tomorrow = hh.tasks.find((x) => x.day === hh.today + 1);
    const who = tomorrow && hh.members.find((m) => m.id === tomorrow.member);
    const what = tomorrow && hh.chores.find((c) => c.id === tomorrow.chore);
    return { text: who && what ? `${who.name}. ${what.name} is on tomorrow.` : "Nothing's planned for tomorrow yet." };
  }
  return { text: `This week is ${fair}% fair. Ask me to move a chore, swap with someone, or add a note for the planner.` };
}

// TODO: POST /households/{id}/assistant/undo { member_id } -> household
export async function assistantUndo(): Promise<void> {
  await wait(400);
}

// TODO: speech-to-text. Needs a dev build with an on-device recogniser, or upload the audio for the backend to transcribe.
export const MOCK_TRANSCRIPTS = {
  assistant: "Move my dishes to Thursday, I've got a study group tonight",
  dictation:
    'Mum works 8 to 5 on weekdays. Dad works from home and is free after 6. Ali is at uni and has exams on Thursday. Zara is 9 and can do small jobs. We need the dishes done every night, laundry twice a week and the floors swept.',
};

// TODO: POST /households/{id}/tasks/{tid}/retake { member_id } -> notify the member to retake the photo
export async function askForRetake(): Promise<void> {
  await wait(400);
}

// TODO: POST /households/{id}/tasks/{tid}/review { member_id } -> add the chore to the admin's Approvals
export async function askAdminToCheck(): Promise<void> {
  await wait(400);
}
