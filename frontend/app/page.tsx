import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Users, FileText, Vote, UserPlus, TrendingUp, BarChart3 } from 'lucide-react';
import type { Metadata } from 'next';

// Static metadata for better SEO and performance
export const metadata: Metadata = {
  title: 'GovTwool - Cardano Governance Made Simple',
  description: 'A modern platform for participating in Cardano on-chain governance. Browse DReps, track actions, and make your voice heard in the ecosystem.',
};

// Mark as static page - no dynamic data fetching
export const dynamic = 'force-static';

export default function Home() {
  const features = [
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: 'Dashboard',
      description: 'Get an overview of governance activity, key metrics, and recent updates',
      link: '/dashboard',
      variant: 'primary' as const,
    },
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

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-br from-field-green/5 via-background to-sky-blue/5" />
        <div className="container mx-auto px-4 py-24 md:py-32 relative">
          <div className="max-w-3xl mx-auto text-center space-y-6 animate-fade-in">
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="text-4xl">🐑</span>
              <h1 className="text-5xl md:text-7xl font-display font-bold bg-gradient-to-r from-field-green to-field-dark bg-clip-text text-transparent dark:from-field-light dark:to-field-green">
                GovTwool
              </h1>
            </div>
            <p className="text-2xl md:text-3xl font-semibold text-foreground">
              Cardano Governance Made Simple
            </p>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A modern platform for participating in Cardano on-chain governance. 
              Browse DReps, track actions, and make your voice heard in the ecosystem.
            </p>
            <div className="flex justify-center gap-4 flex-wrap pt-4">
              <Link href="/dashboard">
                <Button size="lg" variant="primary" className="gap-2">
                  <TrendingUp className="w-5 h-5" />
                  View Dashboard
                </Button>
              </Link>
              <Link href="/dreps">
                <Button size="lg" variant="outline" className="gap-2">
                  <Users className="w-5 h-5" />
                  Explore DReps
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
            Everything You Need for Governance
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Access all Cardano governance tools in one place
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
      </section>

      {/* About Section */}
      <section className="border-t bg-muted/30 relative">
        <div className="container mx-auto px-4 py-16 md:py-24 relative z-10">
          <Card className="max-w-4xl mx-auto">
            <CardContent className="p-8 md:p-12">
              <div className="text-center space-y-6">
                <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground">
                  About GovTwool
                </h2>
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  <p className="text-lg">
                    GovTwool is a user-friendly interface for Cardano's on-chain governance system. 
                    Built with Next.js 16 and powered by Mesh SDK, it provides 
                    an intuitive way to interact with Cardano governance features.
                  </p>
                  <p>
                    Whether you're looking to delegate your voting rights, register as a DRep, 
                    or simply explore the governance landscape, GovTwool makes it easy and accessible.
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

