import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowRight, ArrowLeft, CheckCircle2, User, GraduationCap, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DEGREE_TYPES = ["High School Diploma", "Associate's", "Bachelor's", "Master's", "PhD", "Postdoc"];
const TARGET_COUNTRIES = ["USA", "UK", "Canada", "Australia", "Germany", "France", "Netherlands", "Sweden", "Japan", "South Korea", "Singapore"];
const TARGET_COURSES = ["AI / Machine Learning", "Computer Science", "Data Science", "Fine Arts", "Public Policy", "Business / MBA", "Engineering", "Medicine", "Law", "Environmental Science", "Psychology", "Economics"];
const TARGET_QUALIFICATIONS = ["Bachelors", "Post Graduate Certification", "Masters", "PhD", "Post PhD Fellowship"];

interface EducationEntry {
  id: string;
  degree_type: string;
  institution: string;
  course: string;
  grade: string;
  graduated_year: string;
}

interface Props {
  open: boolean;
  userId: string;
  onComplete: () => void;
}

const STEPS = [
  { label: "Basic Info", icon: User },
  { label: "Education", icon: GraduationCap },
  { label: "Future Goals", icon: Target },
];

const OnboardingModal = ({ open, userId, onComplete }: Props) => {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step A — Basic Info
  const [fullName, setFullName] = useState("");
  const [countryOrigin, setCountryOrigin] = useState("");

  // Step B — Education History
  const [entries, setEntries] = useState<EducationEntry[]>([
    { id: crypto.randomUUID(), degree_type: "", institution: "", course: "", grade: "", graduated_year: "" },
  ]);

  // Step C — Future Goals
  const [targetCountries, setTargetCountries] = useState<string[]>([]);
  const [targetCourses, setTargetCourses] = useState<string[]>([]);
  const [targetQualifications, setTargetQualifications] = useState<string[]>([]);

  const progress = ((step + 1) / STEPS.length) * 100;

  const addEntry = () =>
    setEntries([...entries, { id: crypto.randomUUID(), degree_type: "", institution: "", course: "", grade: "", graduated_year: "" }]);

  const removeEntry = (id: string) =>
    entries.length > 1 && setEntries(entries.filter((e) => e.id !== id));

  const updateEntry = (id: string, field: keyof EducationEntry, value: string) =>
    setEntries(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));

  const toggleTag = (tag: string, list: string[], setter: (v: string[]) => void) =>
    setter(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);

  const isStepAValid = fullName.trim().length > 0 && countryOrigin.trim().length > 0;
  const isStepBValid = entries.every((e) => e.degree_type && e.institution);

  const handleFinish = async () => {
    setSaving(true);
    try {
      // Save education history
      const eduRows = entries.map((e) => ({
        user_id: userId,
        degree_type: e.degree_type,
        institution: e.institution,
        course: e.course || null,
        grade: e.grade || null,
        graduated_year: e.graduated_year ? parseInt(e.graduated_year) : null,
      }));
      const { error: eduErr } = await supabase.from("education_history").insert(eduRows);
      if (eduErr) throw eduErr;

      // Update profile with basic info + future goals
      const { error: profErr } = await supabase.from("profiles").update({
        full_name: fullName,
        country_origin: countryOrigin,
        education_level: targetQualifications.join(", ") || null,
        target_countries: targetCountries,
        target_courses: targetCourses,
        onboarding_completed: true,
      }).eq("id", userId);
      if (profErr) throw profErr;

      toast.success("Onboarding complete! Welcome to ScholarFlow.");
      onComplete();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => String(currentYear - i));

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto rounded-[1.5rem] [&>button]:hidden p-0">
        {/* Progress bar */}
        <div className="px-6 pt-6 pb-2 space-y-4">
          <Progress value={progress} className="h-1.5 rounded-full" />
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = i === step;
              const done = i < step;
              return (
                <div key={s.label} className="flex items-center gap-2">
                  <div className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold transition-colors ${
                    done ? "bg-accent/20 text-accent" : active ? "gradient-gold text-accent-foreground" : "bg-secondary text-muted-foreground"
                  }`}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${active ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 pb-6">
          {/* Step A: Basic Info */}
          {step === 0 && (
            <>
              <DialogHeader className="mb-6">
                <DialogTitle className="text-xl">Let's get to know you</DialogTitle>
                <DialogDescription>Tell us a bit about yourself to get started.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Full Name *</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Adaeze Okonkwo"
                    className="rounded-lg h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Country of Origin *</Label>
                  <Input
                    value={countryOrigin}
                    onChange={(e) => setCountryOrigin(e.target.value)}
                    placeholder="e.g. Nigeria"
                    className="rounded-lg h-11"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-6">
                <Button
                  onClick={() => setStep(1)}
                  disabled={!isStepAValid}
                  className="gradient-gold text-accent-foreground font-semibold rounded-full shadow-gold gap-2"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {/* Step B: Education History */}
          {step === 1 && (
            <>
              <DialogHeader className="mb-6">
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <GraduationCap className="h-5 w-5 text-accent" /> Your Education History
                </DialogTitle>
                <DialogDescription>Add your qualifications. You can add multiple entries.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {entries.map((entry, i) => (
                  <div key={entry.id} className="relative border border-border rounded-[1rem] p-4 space-y-3 bg-secondary/30">
                    {entries.length > 1 && (
                      <button onClick={() => removeEntry(entry.id)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qualification {i + 1}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Degree Type *</Label>
                        <Select value={entry.degree_type} onValueChange={(v) => updateEntry(entry.id, "degree_type", v)}>
                          <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {DEGREE_TYPES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Institution *</Label>
                        <Input value={entry.institution} onChange={(e) => updateEntry(entry.id, "institution", e.target.value)} placeholder="e.g. MIT" className="rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Course</Label>
                        <Input value={entry.course} onChange={(e) => updateEntry(entry.id, "course", e.target.value)} placeholder="e.g. Computer Science" className="rounded-lg" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Grade</Label>
                        <Input value={entry.grade} onChange={(e) => updateEntry(entry.id, "grade", e.target.value)} placeholder="e.g. 4.5 / 5.0" className="rounded-lg" />
                      </div>
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <Label className="text-xs">Graduation Year</Label>
                        <Select value={entry.graduated_year} onValueChange={(v) => updateEntry(entry.id, "graduated_year", v)}>
                          <SelectTrigger className="rounded-lg"><SelectValue placeholder="Year" /></SelectTrigger>
                          <SelectContent>
                            {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}

                <Button variant="outline" size="sm" onClick={addEntry} className="gap-1.5 rounded-full">
                  <Plus className="h-3.5 w-3.5" /> Add Qualification
                </Button>
              </div>

              <div className="flex justify-between pt-6">
                <Button variant="ghost" onClick={() => setStep(0)} className="gap-1.5 rounded-full">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!isStepBValid}
                  className="gradient-gold text-accent-foreground font-semibold rounded-full shadow-gold gap-2"
                >
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {/* Step C: Future Goals */}
          {step === 2 && (
            <>
              <DialogHeader className="mb-6">
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Target className="h-5 w-5 text-accent" /> Your Future Goals
                </DialogTitle>
                <DialogDescription>Select the countries, fields, and qualifications you're aiming for.</DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Target Countries</Label>
                  <div className="flex flex-wrap gap-2">
                    {TARGET_COUNTRIES.map((c) => (
                      <Badge
                        key={c}
                        variant={targetCountries.includes(c) ? "default" : "outline"}
                        className={`cursor-pointer rounded-full px-3 py-1.5 text-xs transition-all ${
                          targetCountries.includes(c) ? "gradient-gold text-accent-foreground border-0" : "hover:bg-secondary"
                        }`}
                        onClick={() => toggleTag(c, targetCountries, setTargetCountries)}
                      >
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Target Courses / Fields</Label>
                  <div className="flex flex-wrap gap-2">
                    {TARGET_COURSES.map((c) => (
                      <Badge
                        key={c}
                        variant={targetCourses.includes(c) ? "default" : "outline"}
                        className={`cursor-pointer rounded-full px-3 py-1.5 text-xs transition-all ${
                          targetCourses.includes(c) ? "gradient-gold text-accent-foreground border-0" : "hover:bg-secondary"
                        }`}
                        onClick={() => toggleTag(c, targetCourses, setTargetCourses)}
                      >
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Target Qualifications</Label>
                  <div className="flex flex-wrap gap-2">
                    {TARGET_QUALIFICATIONS.map((q) => (
                      <Badge
                        key={q}
                        variant={targetQualifications.includes(q) ? "default" : "outline"}
                        className={`cursor-pointer rounded-full px-3 py-1.5 text-xs transition-all ${
                          targetQualifications.includes(q) ? "gradient-gold text-accent-foreground border-0" : "hover:bg-secondary"
                        }`}
                        onClick={() => toggleTag(q, targetQualifications, setTargetQualifications)}
                      >
                        {q}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-6">
                <Button variant="ghost" onClick={() => setStep(1)} className="gap-1.5 rounded-full">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={handleFinish}
                  disabled={saving || (targetCountries.length === 0 && targetCourses.length === 0)}
                  className="gradient-gold text-accent-foreground font-semibold rounded-full shadow-gold gap-2"
                >
                  {saving ? "Saving..." : <><CheckCircle2 className="h-4 w-4" /> Complete Setup</>}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingModal;
