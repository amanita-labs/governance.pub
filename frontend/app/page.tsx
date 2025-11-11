import Link from 'next/link';
import { Users, FileText, Vote, UserPlus, Sprout, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { SheepFlock } from '@/components/animations/SheepFlock';
import { WoolyQuote } from '@/components/ui/WoolyQuote';
import { Badge } from '@/components/ui/Badge';

// Static metadata for better SEO and performance
export const metadata: Metadata = {
  title: 'GovtWool - Cardano Governance Made Wooly',
  description: 'A platform for participating in Cardano on-chain governance.',
};

// Mark as static page - no dynamic data fetching
export const dynamic = 'force-static';

export default function Home() {
  const features = [
    {
      icon: <Users className="w-6 h-6" />,
      title: 'Browse DReps',
      description: 'Explore Delegated Representatives, their voting history, and statistics',
      link: '/dreps',
      variant: 'secondary' as const,
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: 'Governance Actions',
      description: 'View live and past governance actions with detailed voting results',
      link: '/actions',
      variant: 'secondary' as const,
    },
    {
      icon: <Vote className="w-6 h-6" />,
      title: 'Delegate Voting',
      description: 'Delegate your voting rights to a DRep of your choice',
      link: '/delegate',
      variant: 'outline' as const,
    },
    {
      icon: <UserPlus className="w-6 h-6" />,
      title: 'Register as DRep',
      description: 'Become a Delegated Representative and participate in governance',
      link: '/register-drep',
      variant: 'outline' as const,
    },
  ];
  const quickHighlights = [
    'Live governance actions & vote tallies',
    'Battle-tested metadata validation',
    'Wallet-native delegation flows',
  ];

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-wool-gradient">
        <div className="absolute inset-0 pointer-events-none opacity-80">
          <div className="absolute -top-20 -left-24 h-72 w-72 rounded-full bg-field-green/20 blur-3xl" />
          <div className="absolute -bottom-24 right-0 h-60 w-60 rounded-full bg-sky-blue/20 blur-3xl" />
        </div>
        <div className="container relative mx-auto flex flex-col gap-16 px-4 py-20 md:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-3 rounded-full border border-primary/30 bg-background/70 px-4 py-2 text-sm font-medium text-primary backdrop-blur">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>Governance for the whole flock</span>
              </div>
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2">
                  <span className="text-4xl md:text-5xl">🐑</span>
                  <h1 className="text-4xl font-display font-bold text-foreground md:text-6xl">
                    GovtWool
                  </h1>
                </div>
                <p className="text-lg text-muted-foreground md:text-xl">
                  Wrangling Cardano governance into one cozy meadow—follow proposals, delegate your
                  vote, and register as a DRep without losing a single tuft of wool.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href="/dreps">
                  <Button size="lg" className="gap-2">
                    <Users className="h-5 w-5" />
                    Explore DReps
                  </Button>
                </Link>
                <Link href="/delegate">
                  <Button size="lg" variant="outline" className="gap-2">
                    <Vote className="h-5 w-5" />
                    Delegate Power
                  </Button>
                </Link>
                <Link href="/governance">
                  <Button size="lg" variant="ghost" className="gap-2">
                    <Sprout className="h-5 w-5" />
                    Governance Primer
                  </Button>
                </Link>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {quickHighlights.map((highlight) => (
                  <div
                    key={highlight}
                    className="flex items-center gap-2 rounded-lg bg-background/70 px-3 py-2 text-sm text-muted-foreground shadow-sm ring-1 ring-border/60 backdrop-blur"
                  >
                    <span aria-hidden="true">🧶</span>
                    <span>{highlight}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-background/80 p-6 shadow-xl backdrop-blur wooly-border">
                <div className="mb-6 flex items-center justify-center">
                  <SheepFlock count={5} />
                </div>
                <div className="space-y-4 text-center">
                  <h2 className="text-xl font-display font-semibold text-foreground">
                    The Flock Is Already Voting
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Wake up to fresh on-chain insights and follow along as the Cardano community
                    shepherds proposals from idea to enactment.
                  </p>
                  <Badge variant="info" className="mx-auto w-fit gap-2">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>New actions every epoch</span>
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-4xl">
            <WoolyQuote variant="banner" emphasis="bold" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
            Build your flock-friendly workflow
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From first delegation to drafting rationale, GovtWool keeps every governance step soft
            on the hooves and transparent for the herd.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <Link key={index} href={feature.link} className="block h-full group">
              <Card className="h-full cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover border hover:border-primary/50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-semibold text-foreground">{feature.title}</h3>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div className="rounded-3xl border bg-muted/50 p-8 shadow-lg wooly-border">
            <h3 className="text-2xl font-display font-semibold text-foreground mb-4">
              Meet the meadow keepers
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              We stitch together live data from the Cardano governance API, weave in CIP-compliant
              metadata validation, and wrap it all in approachable UI. Whether you&apos;re
              registering as a DRep or nudging your favorite delegate with a vote rationale, this
              pasture is yours.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Badge variant="info" className="gap-2">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                CIP-119 &amp; CIP-136 ready
              </Badge>
              <Badge variant="success" className="gap-2">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                Built for delegators &amp; builders
              </Badge>
            </div>
          </div>
          <WoolyQuote variant="card" className="bg-meadow-haze border-none shadow-xl" />
        </div>
      </section>

      {/* About Section */}
      <section className="border-t bg-muted/30 relative">
        <div className="container mx-auto px-4 py-16 md:py-24 relative z-10">
          <Card className="max-w-4xl mx-auto">
            <CardContent className="p-8 md:p-12">
              <div className="text-center space-y-6">
                <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">
                  About GovtWool
                </h2>
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  <p className="text-lg">
                    GovtWool is your wool-soft interface for Cardano&apos;s on-chain governance,
                    helping curious community members feel right at home in the protocol pasture.
                  </p>
                  <p className="text-muted-foreground">
                    Built for Cardano Summit LayerUp Hackathon by team insects 🪰, and lovingly
                    extended to keep every epoch approachable.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rolling Hills Footer */}
        <div className="relative w-full h-64 overflow-hidden">
          <svg
            className="absolute bottom-0 w-full h-full"
            viewBox="0 0 1200 200"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Far hill */}
            <path
              d="M0,150 Q300,100 600,150 T1200,150 L1200,200 L0,200 Z"
              fill="#7cb342"
              className="dark:fill-field-green/60"
              opacity="0.6"
            />
            {/* Near hill */}
            <path
              d="M0,180 Q400,120 800,180 T1200,180 L1200,200 L0,200 Z"
              fill="#aed581"
              className="dark:fill-field-light/80"
              opacity="0.8"
            />
            {/* Grass */}
            <path
              d="M0,200 Q400,180 800,200 T1200,200 L1200,200 L0,200 Z"
              fill="#558b2f"
              className="dark:fill-field-dark"
            />
          </svg>
        </div>
      </section>
    </main>
  );
}

