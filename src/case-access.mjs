// userId must eventually come from a server-validated session, never the chat prompt.
// This function is the data boundary; it is not a complete authentication system.
export function getPermittedRequest(data, userId, requestId) {
  const user = data.users.find(item => item.id === userId);
  const request = data.requests.find(item => item.id === requestId);
  if (!user || !request || request.company_id !== user.company_id || !request.allowed_user_ids.includes(user.id)) {
    // Same error for missing and forbidden records: do not reveal existence.
    return { ok: false, code: 'REQUEST_NOT_ACCESSIBLE' };
  }
  return { ok: true, request: {
    id: request.id,
    status: request.status,
    hotels_contacted: request.hotels_contacted,
    responses_received: request.responses_received,
    visible_offers: request.offers.filter(offer => offer.customer_visible).length,
    booking_reference: request.booking_reference,
    next_review_at: request.next_review_at,
    updated_at: request.updated_at
  }};
}
