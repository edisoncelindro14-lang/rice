import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Lock, ArrowRight, Eye, EyeOff, X } from "lucide-react";
import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";
import { prefetchTables } from "../lib/useData";
import { saveMemberSession } from "../lib/auth";
import { getSavedCredentials, saveCredentials, removeCredentials } from "../lib/savedCredentials";
import AuthShell, { ORANGE_GRADIENT } from "./AuthShell";
import AuthInput from "./AuthInput";

export default function Login() {
  const nav = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [showPwd, setShowPwd] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState([]);

  useEffect(() => {
    setSaved(getSavedCredentials());
  }, []);

  function fillFromSaved(cred) {
    setForm({ username: cred.username, password: cred.password });
    setShowPwd(true);
  }

  function forgetSaved(username) {
    removeCredentials(username);
    setSaved(getSavedCredentials());
  }

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
      // Persist credentials on this device for quick re-login
      saveCredentials(form.username, form.password);
      saveMemberSession(member.id);
      prefetchTables(["members", "system_settings", "maintenance_codes", "transactions"]);
      toast.success(`Welcome back, ${member.full_name}!`);
      nav("/Dashboard");
    } catch (err) {
      toast.error(err.message || "Login failed. Please try again.");
    }
    setBusy(false);
  }

  return (
    <AuthShell title="ProductPrime Member Log In">
      <form onSubmit={submit} className="space-y-6">
        <AuthInput
          label="Username"
          required
          icon={User}
          name="username"
          autoComplete="username"
          value={form.username}
          onChange={e => setForm({ ...form, username: e.target.value })}
          placeholder="Enter your username"
        />
        <AuthInput
          label="Password"
          required
          icon={Lock}
          type={showPwd ? "text" : "password"}
          name="password"
          autoComplete="current-password"
          value={form.password}
          onChange={e => setForm({ ...form, password: e.target.value })}
          placeholder="Enter your password"
          trailing={
            <button type="button" onClick={() => setShowPwd(!showPwd)} className="hover:opacity-80">
              {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          }
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full h-[52px] rounded-xl text-white text-base font-medium flex items-center justify-center gap-3 shadow-lg hover:brightness-110 transition disabled:opacity-60"
          style={{ background: ORANGE_GRADIENT }}
        >
          {busy ? "Signing in..." : "Login"} <ArrowRight className="w-5 h-5" />
        </button>

        {saved.length > 0 && (
          <div className="space-y-3">
            <p className="text-white/60 text-[13px] text-center">
              Saved on this device — tap to fill:
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {saved.map(cred => (
                <div
                  key={cred.username}
                  className="group flex items-center gap-1.5 rounded-lg px-3 py-2 text-white text-sm border border-white/20 hover:border-orange-400/60 transition-colors cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.15)" }}
                  onClick={() => fillFromSaved(cred)}
                  title={`Fill ${cred.username}`}
                >
                  <span>@{cred.username}</span>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      forgetSaved(cred.username);
                    }}
                    className="opacity-50 hover:opacity-100 transition-opacity"
                    title="Remove saved login"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-white text-[17px]">
          Don't have an account? <Link to="/Register" className="text-orange-400 hover:underline">Register here</Link>
        </p>
      </form>
    </AuthShell>
  );
}
