import { supabase } from "./supabase";
import { generateReferralCode } from "./helpers";

// Quota summary for one store: total allotted by admin, codes generated, remaining.
export function storeQuotaSummary(storeId, quotas, codes) {
  const allotments = quotas
    .filter(q => q.store_member_id === storeId)
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  const generatedCodes = codes
    .filter(c => c.generated_by_store_id === storeId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const allotted = allotments.reduce((s, q) => s + (q.quota_amount || 0), 0);
  const generated = generatedCodes.length;
  return { allotments, generatedCodes, allotted, generated, remaining: Math.max(0, allotted - generated) };
}

// Generate maintenance codes on behalf of a store (optionally designated to a username).
export async function generateStoreCodes(storeId, count, assignedUsername) {
  const records = [];
  for (let i = 0; i < count; i++) {
    const base = "MAINT-" + generateReferralCode();
    records.push({
      code: assignedUsername ? `${base}-@${assignedUsername.toUpperCase()}` : base,
      is_used: false,
      assigned_username: assignedUsername || null,
      generated_by_store_id: storeId,
    });
  }
  const { error } = await supabase.from("maintenance_codes").insert(records);
  if (error) throw error;

  // Auto-add the designated username to the store's phonebook if not already there
  if (assignedUsername) {
    const { data: member } = await supabase
      .from("members")
      .select("id, username")
      .eq("username", assignedUsername)
      .limit(1);
    if (member?.length) {
      await supabase.from("store_phonebook").upsert(
        { store_member_id: storeId, username: assignedUsername, member_id: member[0].id },
        { onConflict: "store_member_id,username", ignoreDuplicates: true }
      );
    }
  }
}
