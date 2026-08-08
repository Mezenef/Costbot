import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import ClosingCTA from "@/components/landing/ClosingCTA";
import AnimatedBackground from "@/components/landing/AnimatedBackground";
import Hero from "@/components/landing/Hero";
import AutomateEfficiency from "@/components/landing/AutomateEfficiency";

export default function LandingPage() {
  return (
    <div className="bg-white dark:bg-gray-900">
      <Hero />
      <div className="relative isolate">
        <AnimatedBackground />
        <div className="relative z-10">
          <HowItWorks />
          <Features />
          <AutomateEfficiency />
          <ClosingCTA />
        </div>
      </div>
      
    </div>
  );
}