import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WALLET_PERSONAS } from "@/types/wallet";

const slides = [
  {
    title: "Meet Alice & Bob",
    content: (
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-12 text-7xl">
          <div className="flex flex-col items-center gap-2">
            <span>{WALLET_PERSONAS.alice.emoji}</span>
            <span className="text-lg font-medium text-foreground">Alice</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <span>{WALLET_PERSONAS.bob.emoji}</span>
            <span className="text-lg font-medium text-foreground">Bob</span>
          </div>
        </div>
        <p className="text-center text-lg text-muted-foreground">
          They'll be sending payments to each other.
        </p>

        <div />
        <p className="text-center text-sm text-muted-foreground">
          ...and later some more friends will join too.
        </p>
        <div className="flex items-center gap-6 text-3xl">
          <div className="flex flex-col items-center gap-1">
            <span>{WALLET_PERSONAS.charlie.emoji}</span>
            <span className="text-sm font-medium text-muted-foreground">
              Charlie
            </span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span>{WALLET_PERSONAS.david.emoji}</span>
            <span className="text-sm font-medium text-muted-foreground">
              David
            </span>
          </div>
        </div>
      </div>
    ),
  },
  {
    title: "The New Economy of the AI Age",
    content: (
      <div className="flex flex-col items-center gap-6">
        <p className="text-center text-lg text-muted-foreground">
          Bitcoin is the open money of the internet.
        </p>
        <p className="text-center text-lg text-muted-foreground">
          Lightning makes payments instant and almost free for machines and apps.
        </p>
        <p className="text-center text-lg text-muted-foreground">
          Nostr gives every person and AI agent their own identity and reputation
          that no company can take away.
        </p>
        <p className="text-center text-lg text-muted-foreground">
          Easy wallet connections let agents use money. Per-use payments let them
          pay only for what they need.
        </p>
        <p className="text-center text-lg text-muted-foreground">
          Together they create a complete system where people and AI agents can
          trade, build trust, and work together without any platform controlling
          everything.
        </p>
        <p className="text-center text-lg font-medium text-foreground">
          This is the foundation of the AI economy.
        </p>
      </div>
    ),
  },
  {
    title: "See It In Action",
    content: (
      <div className="flex flex-col items-center gap-6">
        <p className="text-center text-lg text-muted-foreground">
          Try live examples right in your browser. See how payments and
          connections work in real situations — no setup needed.
        </p>
        <p className="text-center text-lg text-muted-foreground">
          We've created ready-to-use examples based on actual use cases, so you
          can understand everything clearly and get started fast.
        </p>
      </div>
    ),
  },
];

export function GettingStarted() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const isLastSlide = currentSlide === slides.length - 1;

  return (
    <div className="flex h-full items-center justify-center overflow-auto p-6">
      <div className="flex max-w-2xl flex-col items-center gap-10">
        <div
          key={currentSlide}
          className="flex h-96 animate-in fade-in duration-300 flex-col items-center justify-center gap-6"
        >
          <h1 className="text-3xl font-bold text-center">
            {slides[currentSlide].title}
          </h1>
          {slides[currentSlide].content}
        </div>

        <div className="flex flex-col items-center gap-6">
          {isLastSlide ? (
            <Button asChild>
              <Link to="/foundation">
                Try the first scenario &rarr;
              </Link>
            </Button>
          ) : (
            <Button onClick={() => setCurrentSlide((s) => s + 1)}>
              Next &rarr;
            </Button>
          )}

          <div className="flex items-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`h-2 w-2 rounded-full transition-colors ${
                  i === currentSlide ? "bg-primary" : "bg-muted"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
