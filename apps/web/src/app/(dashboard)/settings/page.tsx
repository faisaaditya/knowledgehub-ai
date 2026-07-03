"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Monitor, Moon, Sun, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ThemeOption = {
  value: string;
  label: string;
  description: string;
  icon: React.ReactNode;
};

const themeOptions: ThemeOption[] = [
  {
    value: "light",
    label: "Terang",
    description: "Tampilan putih terang yang nyaman di siang hari.",
    icon: <Sun className="h-5 w-5" />,
  },
  {
    value: "dark",
    label: "Gelap",
    description: "Mode gelap yang nyaman untuk mata di malam hari.",
    icon: <Moon className="h-5 w-5" />,
  },
  {
    value: "system",
    label: "Sistem",
    description: "Ikuti pengaturan tema perangkat Anda secara otomatis.",
    icon: <Monitor className="h-5 w-5" />,
  },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — only render theme UI after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeChange = (value: string) => {
    setTheme(value);
    const label = themeOptions.find((o) => o.value === value)?.label;
    toast.success(`Tema diubah ke mode ${label}.`);
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">
          Kelola preferensi tampilan dan akun Anda.
        </p>
      </div>

      {/* Theme Settings */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">Tema Tampilan</CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Pilih tampilan yang nyaman untuk Anda gunakan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!mounted ? (
            // Skeleton while mounting
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-xl bg-muted animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {themeOptions.map((option) => {
                const isActive = theme === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleThemeChange(option.value)}
                    className={cn(
                      "relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-md",
                      isActive
                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                        : "border-border bg-card hover:border-indigo-300 dark:hover:border-indigo-700"
                    )}
                  >
                    {/* Active checkmark */}
                    {isActive && (
                      <span className="absolute top-3 right-3 flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600">
                        <Check className="h-3 w-3 text-white" />
                      </span>
                    )}

                    {/* Icon */}
                    <span
                      className={cn(
                        "p-2 rounded-lg",
                        isActive
                          ? "bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {option.icon}
                    </span>

                    {/* Label & description */}
                    <div>
                      <p className={cn(
                        "text-sm font-semibold",
                        isActive ? "text-indigo-700 dark:text-indigo-300" : "text-foreground"
                      )}>
                        {option.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {option.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* More settings placeholder */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">Pengaturan Lainnya</CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Fitur pengaturan lainnya akan segera hadir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">🚧 Coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
}
