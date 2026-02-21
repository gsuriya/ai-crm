"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import DarkVeil from '@/components/ui/DarkVeil';
import MagicBento from '@/components/MagicBento';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const [userFirstName, setUserFirstName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const firstName = user.user_metadata?.first_name ||
            user.user_metadata?.given_name ||
            user.user_metadata?.name?.split(' ')[0] ||
            "";
          setUserFirstName(firstName);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  // loading symbol
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-slate-600 animate-spin" />
      </div>
    );
  }
  // userFirstName
  return (
    <div>
        <MagicBento 
            textAutoHide={true}
            enableStars={true}
            enableSpotlight={true}
            enableBorderGlow={true}
            enableTilt={false}
            enableMagnetism={false}
            clickEffect
            spotlightRadius={520}
            particleCount={12}
            glowColor="132, 0, 255"
            disableAnimations={false}
            />
        
    </div>
  );
}
