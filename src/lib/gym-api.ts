import type { components } from './api/schema';
import { call } from './esports-api';

/**
 * Gym member API (M24 §9.2 member endpoints, M20 passes and trainer subscriptions), on the same
 * `call` as the esports screens: errors throw ApiError with the problem+json code. The shapes come
 * from the backend's OpenAPI (src/lib/api/schema.d.ts, `npm run api:sync`). The app is for members and
 * guests; the only staff calls are a staff member's own clock and payslips (the last block). No NID is
 * ever asked for (gym members never need it).
 */
type S = components['schemas'];

export type MyMemberships = S['MyGymMemberships'];
export type MembershipCard = MyMemberships['items'][number];
export type MyMembership = S['MyGymMembership'];
export type Membership = NonNullable<MyMembership['memberships'][number]>;
export type MemberDue = NonNullable<MyMembership['dues'][number]>;
export type FeePayment = NonNullable<MemberDue['payments']>[number];
export type Receipt = MyMembership['receipts'][number];
export type Calendar = S['GymCheckinCalendar'];
export type CheckinToken = S['GymCheckinToken'];
export type MyRequests = S['MyGymRequests'];
export type GymRequest = MyRequests['items'][number];
export type RequestStatus = GymRequest['status'];
export type MyDues = S['MyGymDues'];
export type Due = MyDues['items'][number];
export type PayStart = S['GymPayStart'];
export type MyPlans = S['MyGymPlans'];
export type PlanItem = MyPlans['items'][number];
export type MyPlan = S['MyGymPlan'];
export type PlanContent = S['GymPlanContent'];
export type WorkoutContent = S['GymWorkoutContent'];
export type DietContent = S['GymDietContent'];
export type PlanLog = S['GymPlanLog'];
export type EntranceCheckin = S['MyGymEntranceCheckin'];
export type Pass = S['GymPassList']['items'][number];
export type PassResult = S['GymPassResult'];
export type Subscription = S['TrainerSubscriptionList']['items'][number];
export type PayerPayment = S['PayerPayment'];

const enc = encodeURIComponent;

// ---------------------------------------------------------------- memberships (M24-FR-14 to FR-21, FR-50)
export const myMemberships = () => call<MyMemberships>('GET', '/me/gym-memberships');
export const myMembership = (memberId: string) => call<MyMembership>('GET', `/me/gym-memberships/${enc(memberId)}`);
export const myAttendance = (memberId: string, month: string) => call<Calendar>('GET', `/me/gym-memberships/${enc(memberId)}/attendance`, { query: { month } });
export const checkinToken = (memberId: string) => call<CheckinToken>('GET', `/me/gym-memberships/${enc(memberId)}/checkin-token`);
export const saveHealthNote = (memberId: string, text: string | null) =>
  call<{ memberId: string; healthNote: string | null; healthNoteAt: string | null }>('PUT', `/me/gym-memberships/${enc(memberId)}/health-note`, { body: { text } });
export const unlink = (memberId: string) => call<{ memberId: string; linked: false }>('POST', `/me/gym-memberships/${enc(memberId)}/unlink`);

// ---------------------------------------------------------------- requests (M24-FR-15, FR-16)
export const myRequests = (status?: RequestStatus) => call<MyRequests>('GET', '/me/gym-requests', { query: { status } });
export const acceptRequest = (requestId: string) => call<{ request: { id: string; status: 'accepted' }; memberId: string; gymId: string }>('POST', `/me/gym-requests/${enc(requestId)}/accept`);
export const declineRequest = (requestId: string) => call<{ request: { id: string; status: 'declined' } }>('POST', `/me/gym-requests/${enc(requestId)}/decline`);
export const cancelRequest = (requestId: string) => call<{ request: { id: string; status: 'cancelled' } }>('POST', `/me/gym-requests/${enc(requestId)}/cancel`);

// ---------------------------------------------------------------- dues and paying them (M24-FR-41)
export const myDues = () => call<MyDues>('GET', '/me/gym-dues');
/** Creates (or reuses) the due's payment; the app then pays it on pay/[paymentId]. One key per tap. */
export const payDue = (dueId: string, key: string) => call<PayStart>('POST', `/me/gym-dues/${enc(dueId)}/pay`, { key });

// ---------------------------------------------------------------- plans (M24-FR-64 to FR-69)
export const myPlans = () => call<MyPlans>('GET', '/me/gym-plans');
export const myPlan = (assignmentId: string) => call<MyPlan>('GET', `/me/gym-plans/${enc(assignmentId)}`);
export const logPlan = (assignmentId: string, body: { localDate: string; itemRef: string; done: boolean; note: string | null }) =>
  call<{ log: PlanLog }>('POST', `/me/gym-plans/${enc(assignmentId)}/logs`, { body });

// ---------------------------------------------------------------- entrance check-in (M24-FR-51)
export const entranceCheckin = (token: string) => call<EntranceCheckin>('POST', '/me/gym-checkins', { body: { token } });

// ---------------------------------------------------------------- M20 passes and trainer subscriptions
export const myPasses = (status: 'active' | 'used' | 'expired') => call<S['GymPassList']>('GET', '/me/passes', { query: { status } });
export const myPass = (code: string) => call<PassResult>('GET', `/me/passes/${enc(code)}`);
export const mySubscriptions = () => call<S['TrainerSubscriptionList']>('GET', '/me/subscriptions');

// ---------------------------------------------------------------- the public gym directory (M20 §4, M24 §4.1): no sign-in needed
export type GymList = S['GymList'];
export type GymCard = S['GymCard'];
/** `whatsapp` (M24-FR-158): the gym's chat number in E.164, or null; optional until the API types are synced. */
export type GymPage = S['GymPage'] & { whatsapp?: string | null };
export type GymPackage = GymPage['packages'][number];
export type Area = { id: string; nameEn: string; nameBn: string };

export const listGyms = (query: Record<string, string | number>) => call<GymList>('GET', '/gym/gyms', { query });
export const gymPage = (slug: string) => call<GymPage>('GET', `/gym/gyms/${enc(slug)}`);
export const listAreas = async () => (await call<{ items: Area[] }>('GET', '/catalog/areas', { query: { service: 'delivery' } })).items;

/** Buy a pass (gate buy_gym_pass: a verified phone): one payment into escrow, paid on pay/[paymentId]. */
export const buyPass = (packageId: string, validFrom: string, key: string) => call<PassResult>('POST', '/gym/passes', { body: { packageId, validFrom }, key });
/** Ask a gym to add me as a member (M24-FR-16; needs a verified phone, never NID). */
export const joinGym = (body: { gymId: string; packageId?: string; note?: string }) => call<unknown>('POST', '/me/gym-join-requests', { body });

// ---------------------------------------------------------------- classes (M27-FR-48 to FR-50)
export type Timetable = S['MyGymTimetable'];
export type ClassSession = Timetable['items'][number];
export type ClassBooking = S['GymClassBooking'];
export type PublicTimetable = S['GymPublicTimetable'];

export const myClasses = (memberId: string) => call<Timetable>('GET', '/me/gym-classes', { query: { memberId } });
/** Book a place (or join the waitlist when the places are taken). One key per tap. */
export const bookClass = (sessionId: string, memberId: string, key: string) => call<ClassBooking>('POST', `/me/gym-classes/${enc(sessionId)}/book`, { body: { memberId }, key });
export const cancelClassBooking = (bookingId: string) => call<ClassBooking>('POST', `/me/gym-bookings/${enc(bookingId)}/cancel`);
/** The week's classes on a gym's page, with the places left (M27-FR-67): no sign-in. */
export const gymTimetable = (slug: string) => call<PublicTimetable>('GET', `/gym/gyms/${enc(slug)}/timetable`);

// ---------------------------------------------------------------- points and my body (M27-FR-61, FR-30)
export type Points = S['MyGymPoints'];
export type Reward = Points['rewards'][number];
export type Health = S['GymHealthProfile'];
export type BloodGroup = NonNullable<Health['bloodGroup']>;

export const myPoints = (memberId: string) => call<Points>('GET', '/me/gym-points', { query: { memberId } });
export const saveHealth = (memberId: string, body: { bloodGroup?: BloodGroup | null; heightCm?: number | null; weightKg?: number | null; medical?: string | null }) =>
  call<Health>('PUT', `/me/gym-memberships/${enc(memberId)}/health`, { body });

// ---------------------------------------------------------------- the exercise library (M27-FR-70, FR-71): public, cached
export type Exercise = S['CatalogExercises']['items'][number];
export const listExercises = async () => (await call<S['CatalogExercises']>('GET', '/catalog/exercises')).items;

// ---------------------------------------------------------------- free trial visits (M24 §17, FR-110 to FR-112)
export type VisitSlots = S['GymVisitSlots'];
export type MyVisit = S['MyGymVisit'];

export const visitSlots = (slug: string) => call<VisitSlots>('GET', `/gym/gyms/${enc(slug)}/visit-slots`);
export const myVisits = async () => (await call<S['MyGymVisits']>('GET', '/me/gym-visits')).items;
/** Book a free visit (gate join_gym: a verified phone, never NID). Confirmed at once. One key per tap. */
export const bookVisit = (body: { gymId: string; date: string; arriveAt: string }, key: string) => call<S['MyGymVisitOne']>('POST', '/me/gym-visits', { body, key });
export const cancelVisit = (visitId: string) => call<S['MyGymVisitOne']>('POST', `/me/gym-visits/${enc(visitId)}/cancel`);

// ---------------------------------------------------------------- my work at a gym (M27-FR-73, FR-75, FR-81)
// The only staff calls the app makes: my own clock and my own payslips. Running the desk stays on gym.kriraghor.com.
export type Workplace = S['GymManageGyms']['items'][number];
export type MyClock = S['GymMyClock'];
export type StaffClocked = S['GymStaffClocked'];
export type Payslip = S['GymMyPayslips']['items'][number];

export const myWorkplaces = async () => (await call<S['GymManageGyms']>('GET', '/manage/gyms')).items;
export const myClock = (gymId: string) => call<MyClock>('GET', `/manage/gyms/${enc(gymId)}/staff-clock/me`);
/** Scan the gym's entrance QR: clocks me in, or out when I am in. */
export const staffClock = (token: string) => call<StaffClocked>('POST', '/me/gym-staff-clock', { body: { token } });
export const myPayslips = async (gymId: string) => (await call<S['GymMyPayslips']>('GET', `/manage/gyms/${enc(gymId)}/my-payslips`)).items;

// ---------------------------------------------------------------- M24 §19 and §20: my renewal, my body progress
export type MyRenewal = S['MyGymRenewal'];
export type RenewalChoice = MyRenewal['packages'][number];
export type Renewed = S['GymRenewedByMember'];
export type RenewPay = 'online' | 'counter';
export type BodyProgress = S['GymBodyProgress'];
export type BodyEntry = BodyProgress['entries'][number];

/** Can I renew this membership myself, with which packages; a renewal that already waits (M24-FR-122). */
export const myRenewal = (memberId: string) => call<MyRenewal>('GET', `/me/gym-memberships/${enc(memberId)}/renewal`);
/** Renew: `payment` comes back when paying online; at the counter the fee waits as a due (M24-FR-123). */
export const renewMine = (memberId: string, body: { packageId?: string; pay: RenewPay }, key: string) => call<Renewed>('POST', `/me/gym-memberships/${enc(memberId)}/renew`, { body, key });
/** Take back a renewal I made, while it has not started and nothing is paid on it (M24-FR-125). */
export const cancelRenewal = (memberId: string) => call<MyRenewal>('POST', `/me/gym-memberships/${enc(memberId)}/renewal/cancel`);
/** My measurements over time at this gym; `on: false` when the gym's plan lacks it (M24-FR-130). */
export const myBody = (memberId: string) => call<BodyProgress>('GET', `/me/gym-memberships/${enc(memberId)}/body`);
export const addBody = (memberId: string, body: Record<string, number | string>, key: string) => call<BodyProgress>('POST', `/me/gym-memberships/${enc(memberId)}/body`, { body, key });
export const voidBody = (memberId: string, entryId: string) => call<BodyProgress>('POST', `/me/gym-memberships/${enc(memberId)}/body/${enc(entryId)}/void`);

// ---------------------------------------------------------------- WhatsApp from my gym (M24-FR-159): step 1, the member side
// Sending from the gym through the WhatsApp API is a later step and switched off; this is my number and what I agree to.
export type MyGymWhatsapp = {
  /** Receipts and reminders (WhatsApp utility messages). */
  service: boolean;
  /** News and offers (WhatsApp marketing messages). */
  news: boolean;
  source: 'member' | 'desk' | 'stop_reply' | null;
  at: string | null;
  numberLast4: string | null;
  consentVersion: number | null;
  currentVersion: number;
  /** My own WhatsApp number (E.164), or null to use my phone in the gym's record. */
  number: string | null;
  /** My phone in the gym's record (E.164), the default number. */
  phone: string | null;
  gymName: string;
};

export const myGymWhatsapp = (memberId: string) => call<MyGymWhatsapp>('GET', `/me/gym-whatsapp/${enc(memberId)}`);
/** 422 VALIDATION_FAILED (errors[0].field 'number') for a bad number, 423 GYM_SUSPENDED, 404 when not my membership. */
export const saveGymWhatsapp = (memberId: string, body: { number: string | null; service: boolean; news: boolean }) =>
  call<MyGymWhatsapp>('PUT', `/me/gym-whatsapp/${enc(memberId)}`, { body });
