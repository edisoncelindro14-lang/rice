import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import { saveMemberSession } from "../lib/auth";
import TechBackground from "./TechBackground";

const LOGO_URL = "https://media.base44.com/images/public/6ac1daab80dea63a77ad8fa1/66582b089_Firefly.png";

// Shared gradient: vibrant orange to yellow
const ORANGE_GRADIENT = "linear-gradient(135deg, #FF9800, #FBC02D)";

const inputClass =
  "w-full h-12 pl-12 pr-4 rounded-xl text-white placeholder-white/40 border border-white/20 focus:border-orange-400 focus:outline-none transition-colors";

export default function Login() {
  const nav = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [showPwd, setShowPwd] = useState(true);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!form.username || !form.password) {
      toast.error("Please enter username and password");
      return;
    }
    setBusy(true);
    try {
      const { data: members, error } = await supabase
        .from("members")
        .select("*")
        .eq("username", form.username)
        .limit(1);
      if (error) throw error;
      const member = members?.[0];
      if (!member || member.password !== form.password) {
        toast.error("Invalid username or password");
        setBusy(false);
        return;
      }
      saveMemberSession(member.id);
      toast.success(`Welcome back, ${member.full_name}!`);
      nav("/Dashboard");
    } catch (err) {
      toast.error(err.message || "Login failed. Please try again.");
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
          <div className="p-8 text-center" style={{ background: ORANGE_GRADIENT }}>
            <img
              src={LOGO_URL}
              alt="ProductPrime"
              className="w-20 h-20 rounded-full mx-auto mb-4 object-cover shadow-lg border-2 border-white/40"
            />
            <h1 className="text-2xl font-bold text-white tracking-wide">ProductPrime Member Log In</h1>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="p-8 space-y-5">
            <h2 className="text-xl font-bold text-white text-center">Member Login</h2>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-white">Username</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                <input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="Enter your username"
                  className={inputClass}
                  style={{ background: "rgba(255, 255, 255, 0.06)" }}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-white">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                <input
                  type={showPwd ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Enter your password"
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

            <button
              type="submit"
              disabled={busy}
              className="w-full h-12 rounded-full text-white font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: ORANGE_GRADIENT }}
            >
              {busy ? "Signing in..." : "Login"} <ArrowRight className="w-5 h-5" />
            </button>

            <p className="text-center text-white/70 text-sm">
              Don't have an account?{" "}
              <Link to="/Register" className="text-orange-400 font-semibold hover:underline">
                Register here
              </Link>
            </p>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
