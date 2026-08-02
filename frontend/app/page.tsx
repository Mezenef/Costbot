import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import ClosingCTA from "@/components/landing/ClosingCTA";
import AnimatedBackground from "@/components/landing/AnimatedBackground";
import Hero from "@/components/landing/Hero";

export default function LandingPage() {
  return (
    <div className="bg-white dark:bg-gray-900">
      <Hero />
      <div className="relative isolate">
        <AnimatedBackground />
        <div className="relative z-10">
          <HowItWorks />
          <Features />
          <ClosingCTA />
        </div>
      </div>
      <div className="relative isolate h-24">
        <AnimatedBackground variant="sparse" />
      </div>
    </div>
  );
}