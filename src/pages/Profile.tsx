import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Save } from "lucide-react";
import { toast } from "sonner";

const COUNTRIES = ["USA", "UK", "Canada", "Australia", "Germany", "France", "Netherlands", "Sweden", "Japan", "South Korea", "Singapore", "Other"];
const EDU_LEVELS = ["High School", "Undergraduate", "Graduate", "PhD", "Postdoc"];

const Profile = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [countryOrigin, setCountryOrigin] = useState("");
  const [targetCountries, setTargetCountries] = useState<string[]>([]);
  const [newCountry, setNewCountry] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      if (data) {
        setFullName(data.full_name ?? "");
        setBio(data.bio ?? "");
        setEducationLevel(data.education_level ?? "");
        setCountryOrigin(data.country_origin ?? "");
        setTargetCountries(data.target_countries ?? []);
      }
      setLoadingProfile(false);
    });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: fullName,
      bio,
      education_level: educationLevel,
      country_origin: countryOrigin,
      target_countries: targetCountries,
    }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated!");
  };

  const addCountry = () => {
    if (newCountry && !targetCountries.includes(newCountry)) {
      setTargetCountries([...targetCountries, newCountry]);
      setNewCountry("");
    }
  };

  if (loading || loadingProfile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container pt-24 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-24 pb-12 max-w-2xl">
        <h1 className="font-display text-3xl font-bold mb-8 animate-fade-in">Your Profile</h1>
        <Card className="shadow-card animate-fade-in">
          <CardHeader>
            <CardTitle className="font-display">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Tell us about yourself..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Education Level</Label>
                <Select value={educationLevel} onValueChange={setEducationLevel}>
                  <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>
                    {EDU_LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Country of Origin</Label>
                <Select value={countryOrigin} onValueChange={setCountryOrigin}>
                  <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Target Countries</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {targetCountries.map(c => (
                  <Badge key={c} variant="secondary" className="flex items-center gap-1">
                    {c}
                    <button onClick={() => setTargetCountries(targetCountries.filter(tc => tc !== c))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Select value={newCountry} onValueChange={setNewCountry}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Add country" /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.filter(c => !targetCountries.includes(c)).map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={addCountry}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            <Button onClick={handleSave} className="w-full gradient-gold text-accent-foreground font-semibold shadow-gold" disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
