"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { InputRhf } from "../../../components/forms/input_rhf";
import { Button } from "../../../components/ui/button";
import { Form } from "../../../components/ui/form";
import { fetchApi } from "../../../utils/fetch_api";
import { type LoginSchema, loginSchema, loginSchemaDefaultValues } from "../schemas/login_schema";
import { useTranslation } from "react-i18next";
import { useState } from "react";

export const SignInForm = () => {
  const { t } = useTranslation("login");
  const navigate = useNavigate();
  const form = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: loginSchemaDefaultValues,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const onSubmit = async (data: LoginSchema) => {
    try {
      const response = await fetchApi<{ token: { token: string } }>("auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      });

      localStorage.setItem("token", response.token.token);
      navigate("/");
    } catch (error) {
      setLoginError(t("errors.invalid_credentials"));
    }
  };

  return (
    <Form {...form}>
      <form className="flex flex-col gap-y-6 w-full" onSubmit={form.handleSubmit(onSubmit)}>
        <InputRhf
          control={form.control}
          name="email"
          label={undefined}
          placeholder={t("form.email.placeholder")}
          className="bg-[#3b2f56] border-none rounded-xl h-14 text-lg placeholder:text-[#b3a7c9] text-white focus:ring-2 focus:ring-[#a78bfa] focus:outline-none"
        />
        <div className="relative">
          <InputRhf
            control={form.control}
            name="password"
            label={undefined}
            placeholder={t("form.password.placeholder")}
            type={showPassword ? "text" : "password"}
            className="bg-[#3b2f56] border-none rounded-xl h-14 text-lg placeholder:text-[#b3a7c9] text-white pr-12 focus:ring-2 focus:ring-[#a78bfa] focus:outline-none"
          />
          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#b3a7c9] hover:text-[#a78bfa]"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t("form.password.hide") : t("form.password.show")}
          >
            {showPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-5.523 0-10-4.477-10-10 0-1.657.403-3.22 1.125-4.575M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.875-4.575A9.956 9.956 0 0122 9c0 5.523-4.477 10-10 10a9.956 9.956 0 01-4.575-1.125M3 3l18 18"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm7.5 0c0 5.523-4.477 10-10 10S2.5 17.523 2.5 12 6.977 2 12.5 2s10 4.477 10 10z"
                />
              </svg>
            )}
          </button>
        </div>
        {loginError && (
          <p className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
            {loginError}
          </p>
        )}
        <Button
          type="submit"
          className="h-12 rounded-xl text-lg font-semibold bg-[#4f4f7c] text-white hover:bg-[#a78bfa] hover:text-[#1a1a2e] transition"
        >
          {t("form.login.label")}
        </Button>
      </form>
    </Form>
  );
};
