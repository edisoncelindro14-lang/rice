import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Lock, ArrowLeft, UserPlus, Eye, EyeOff, GitBranch } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import { saveMemberSession } from "../lib/auth";
import { generateReferralCode } from "../lib/helpers";
import TechBackground from "./TechBackground";

const LOGO_URL = "https://media.base44.com/images/public/6ac1daab80dea63a77ad8fa1/66582b089_Firefly.png";

// Shared gradient: vibrant orange to yellow
const ORANGE_GRADIENT = "linear-gradient(135deg, #FF9800, #FBC02D)";
// Gold metallic gradient for the Terms button
const GOLD_GRADIENT =
  "linear-gradient(135deg, #f4d47c 0%, #e6b84d 25%, #d4a017 50%, #e6b84d 75%, #f4d47c 100%)";

const inputClass =
  "w-full h-12 pl-12 pr-4 rounded-xl text-white placeholder-white/40 border border-white/20 focus:border-orange-400 focus:outline-none transition-colors";

export default function Register() {
  const [params] = useSearchParams();
  const ref = params.get("ref") || "";
  const nav = useNavigate();
  const [form, setForm] = useState({ username: "", password: "", confirm_password: "" });
  const [showPwd, setShowPwd] = useState(true);
  const [busy, setBusy] = useState(false);
  const [referrerInfo, setReferrerInfo] = useState(null);
  const [usernameStatus, setUsernameStatus] = useState("idle"); // idle | checking | taken | available

  useEffect(() => {
    if (!ref) return;
    (async () => {
      const { data } = await supabase.from("members").select("username,referral_code,full_name").eq("referral_code", ref).limit(1);
      if (data?.[0]) setReferrerInfo(data[0]);
    })();
  }, [ref]);

  // Live username availability check (debounced)
  useEffect(() => {
    const username = form.username.trim();
    if (!username) { setUsernameStatus("idle"); return; }
    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      const { data: existing } = await supabase.from("members").select("id").ilike("username", username).limit(1);
      setUsernameStatus(existing?.length > 0 ? "taken" : "available");
    }, 400);
    return () => clearTimeout(timer);
  }, [form.username]);

  async function submit(e) {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (usernameStatus === "taken") {
      toast.error("Username is already taken. Please choose another.");
      return;
    }
    setBusy(true);
    try {
      const { data: existing } = await supabase.from("members").select("id").ilike("username", form.username.trim()).limit(1);
      if (existing?.length > 0) {
        toast.error("Username already taken");
        setBusy(false);
        return;
      }
      let referrerId = null;
      if (ref) {
        const { data: referrer } = await supabase.from("members").select("id").eq("referral_code", ref).limit(1);
        if (referrer?.[0]) referrerId = referrer[0].id;
      }
      const { data: newMember, error } = await supabase
        .from("members")
        .insert({
          username: form.username,
          password: form.password,
          full_name: form.username,
          referral_code: generateReferralCode(),
          referrer_id: referrerId,
          status: referrerId ? "pending" : "approved",
          role: "member",
          tree_level: 0,
        })
        .select()
        .single();
      if (error) throw error;
      saveMemberSession(newMember.id);
      toast.success(`Welcome, ${newMember.full_name}!`);
      nav("/Dashboard");
    } catch (err) {
      toast.error(err.message || "Registration failed");
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden">
      <TechBackground />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        {/* Frosted glass card */}
        <div
          className="rounded-3xl border-2 border-white/20 shadow-2xl overflow-hidden"
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          {/* Header */}
          <div className="relative p-8 text-center" style={{ background: ORANGE_GRADIENT }}>
            {/* Back to Login link — top-left inside header */}
            <Link
              to="/MemberLogin"
              className="absolute top-4 left-4 inline-flex items-center gap-1.5 text-white/90 hover:text-white text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Login
            </Link>
            <img
              src={LOGO_URL}
              alt="ProductPrime"
              className="w-20 h-20 rounded-full mx-auto mb-4 object-cover shadow-lg border-2 border-white/40"
            />
            <h1 className="text-2xl font-bold text-white tracking-wide">ProductPrime Registration Form</h1>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="p-8 space-y-5">
            {referrerInfo && (
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-3 border border-white/20"
                style={{ background: "rgba(255, 152, 0, 0.1)" }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: ORANGE_GRADIENT }}
                >
                  <GitBranch className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-orange-400 font-medium">Referred by</p>
                  <p className="text-sm font-bold text-white truncate">@{referrerInfo.username}</p>
                  <p className="text-xs text-white/50">Referral Code: {referrerInfo.referral_code}</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-white">Username *</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                <input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="Choose a username"
                  className={`${inputClass} pr-12 ${usernameStatus === "taken" ? "border-red-400 focus:border-red-500" : usernameStatus === "available" ? "border-green-400 focus:border-green-500" : ""}`}
                  style={{ background: "rgba(255, 255, 255, 0.06)" }}
                  required
                />
                {usernameStatus === "taken" && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 text-sm font-medium">✕ Taken</span>
                )}
                {usernameStatus === "available" && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500 text-sm font-medium">✓ Available</span>
                )}
                {usernameStatus === "checking" && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 text-sm">Checking...</span>
                )}
              </div>
              {usernameStatus === "taken" && (
                <p className="text-sm text-red-500 font-medium">This username is already taken. Please choose another.</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-white">Password *</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                <input
                  type={showPwd ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="At least 6 characters"
                  className={`${inputClass} pr-12`}
                  style={{ background: "rgba(255, 255, 255, 0.06)" }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80"
                >
                  {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-white">Confirm Password *</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                <input
                  type={showPwd ? "text" : "password"}
                  value={form.confirm_password}
                  onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                  placeholder="Re-enter your password"
                  className={inputClass}
                  style={{ background: "rgba(255, 255, 255, 0.06)" }}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full h-12 rounded-full text-white font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: ORANGE_GRADIENT }}
            >
              {busy ? "Submitting..." : "Submit Registration"} <UserPlus className="w-5 h-5" />
            </button>

            <p className="text-center text-white/70 text-sm">
              Already have an account?{" "}
              <Link to="/MemberLogin" className="text-orange-400 font-semibold hover:underline">
                Login here
              </Link>
            </p>

            <a href="https://forms.gle/bMLvWgG2KGfYXzBz8" target="_blank" rel="noopener noreferrer">
              <button
                type="button"
                className="w-full h-12 rounded-full font-bold text-gray-900 transition-all hover:opacity-90"
                style={{ background: GOLD_GRADIENT }}
              >
                Membership Terms &amp; Conditions
              </button>
            </a>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
