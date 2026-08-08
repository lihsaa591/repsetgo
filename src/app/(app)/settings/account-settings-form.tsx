"use client";

import { useRef } from "react";
import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera } from "lucide-react";
import { updateProfile } from "@/lib/server/users/actions";
import { uploadAvatar } from "@/lib/server/users/avatar-actions";
import type { SafeUser } from "@/lib/server/auth/dal";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AccountSettingsForm({ user }: { user: SafeUser }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarFormRef = useRef<HTMLFormElement>(null);

  const [profileState, profileAction, profilePending] = useActionState(
    updateProfile,
    undefined
  );
  const [avatarState, avatarAction] = useActionState(
    async (_prevState: { error: string } | { url: string } | undefined, formData: FormData) =>
      uploadAvatar(formData),
    undefined
  );

  const avatarUrl =
    (avatarState && "url" in avatarState ? avatarState.url : undefined) ??
    user.avatarUrl ??
    undefined;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    avatarFormRef.current?.requestSubmit();
  }

  return (
    // The avatar upload is its own <form>, so it must be a sibling of the
    // profile <form> — browsers drop nested forms when parsing the HTML.
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Photo</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            ref={avatarFormRef}
            action={avatarAction}
            className="flex items-center gap-4"
          >
            <Avatar className="h-16 w-16">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile photo" />}
              <AvatarFallback>{initials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera className="h-3.5 w-3.5" />
                Change photo
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                name="avatar"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <p className="text-xs text-muted-foreground">
                JPG, PNG or WebP, up to 2MB
              </p>
              {avatarState && "error" in avatarState && (
                <p className="text-xs text-destructive">{avatarState.error}</p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <form action={profileAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={user.name} />
            {profileState?.errors?.name && (
              <p className="text-xs text-destructive">{profileState.errors.name[0]}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              defaultValue={user.email}
              disabled
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal Info</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="height">Height (cm)</Label>
              <Input
                id="height"
                name="heightCm"
                type="number"
                placeholder="175"
                defaultValue={user.heightCm ?? ""}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="weight">Current weight (kg)</Label>
              <Input
                id="weight"
                name="weightKg"
                type="number"
                placeholder="70"
                defaultValue={user.weightKg ?? ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="dob">Date of birth</Label>
              <Input
                id="dob"
                name="dob"
                type="date"
                defaultValue={user.dob ?? ""}
                onClick={(e) => e.currentTarget.showPicker?.()}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="gender">Gender</Label>
              <Select name="gender" defaultValue={user.gender ?? undefined}>
                <SelectTrigger id="gender" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="prefer-not-to-say">
                    Prefer not to say
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="goal">Fitness goal</Label>
            <Select name="goal" defaultValue={user.goal ?? undefined}>
              <SelectTrigger id="goal" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="build-muscle">Build muscle</SelectItem>
                <SelectItem value="lose-weight">Lose weight</SelectItem>
                <SelectItem value="maintain">Maintain</SelectItem>
                <SelectItem value="improve-endurance">
                  Improve endurance
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="activity">Activity level</Label>
            <Select name="activityLevel" defaultValue={user.activityLevel ?? undefined}>
              <SelectTrigger id="activity" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentary">
                  Sedentary (little to no exercise)
                </SelectItem>
                <SelectItem value="light">Light (1-3 days/week)</SelectItem>
                <SelectItem value="moderate">Moderate (3-5 days/week)</SelectItem>
                <SelectItem value="active">Active (6-7 days/week)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferences</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="unit">Preferred weight unit</Label>
            <Select name="unitPreference" defaultValue={user.unitPreference}>
              <SelectTrigger id="unit" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">Kilograms (kg)</SelectItem>
                <SelectItem value="lb">Pounds (lb)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {profileState?.message && (
        <p className="text-xs text-muted-foreground">{profileState.message}</p>
      )}
      <Button type="submit" disabled={profilePending} className="w-fit">
        {profilePending ? "Saving..." : "Save changes"}
      </Button>
      </form>
    </div>
  );
}
