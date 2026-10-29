import type { components } from './api/schema';
import { call } from './esports-api';

/**
 * Gym member API (M24 §9.2 member endpoints, M20 passes and trainer subscriptions), on the same
 * `call` as the esports screens: errors throw ApiError with the problem+json code. The shapes come
 * from the backend's OpenAPI (src/lib/api/schema.d.ts, `npm run api:sync`). Members only: no owner
 * or staff endpoint is called from the app, and no NID is ever asked for (gym members never need it).
 */
type S = components['schemas'];

export type MyMemberships = S['MyGymMemberships'];
export type MembershipCard = MyMemberships['items'][number];
export type MyMembership = S['MyGymMembership'];
export type Membership = MyMembership['memberships'][number];
export type MemberDue = MyMembership['dues'][number];
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
