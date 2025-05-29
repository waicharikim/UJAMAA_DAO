import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Heart, Users, Vote, Coins, Shield, Globe, Award, TreePine, HandHeart, ArrowRight } from "lucide-react"

const values = [
  {
    icon: Heart,
    title: "Ubuntu",
    description: "I am because we are - the foundation of our community spirit",
    color: "from-red-500 to-pink-500",
  },
  {
    icon: HandHeart,
    title: "Harambee",
    description: "Pulling together for collective progress and mutual support",
    color: "from-orange-500 to-yellow-500",
  },
  {
    icon: TreePine,
    title: "Sustainability",
    description: "Environmental stewardship for sustainable community development",
    color: "from-green-500 to-emerald-500",
  },
]

const features = [
  {
    icon: Vote,
    title: "Decentralized Governance",
    description: "Transparent, blockchain-based voting system where every voice matters",
  },
  {
    icon: Users,
    title: "Community Groups",
    description: "Location-based groups fostering local connections and initiatives",
  },
  {
    icon: Coins,
    title: "Token Economy",
    description: "Earn and spend community tokens through meaningful contributions",
  },
  {
    icon: Award,
    title: "Impact Recognition",
    description: "Point system that celebrates positive community contributions",
  },
  {
    icon: Shield,
    title: "Secure & Transparent",
    description: "Built on blockchain technology ensuring security and transparency",
  },
  {
    icon: Globe,
    title: "Pan-African Vision",
    description: "Connecting communities across Africa and beyond",
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-16">
          <Badge className="mb-6 bg-gradient-to-r from-orange-500 to-red-500 text-white border-0">
            🌍 About UJAMAA
          </Badge>

          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-orange-600 via-red-600 to-green-600 bg-clip-text text-transparent">
            UJAMAA DAO
          </h1>

          <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            A Decentralized Autonomous Organization that embodies African values of community, cooperation, and
            collective progress through blockchain technology.
          </p>
        </div>

        {/* Mission Statement */}
        <Card className="mb-16 border-0 bg-gradient-to-r from-orange-500 to-red-500 text-white">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold mb-4">Our Mission</h2>
            <p className="text-xl leading-relaxed max-w-4xl mx-auto">
              To create a digital platform that strengthens African communities through transparent governance,
              collaborative decision-making, and shared economic prosperity, rooted in the timeless African philosophy
              of Ubuntu and the spirit of Harambee.
            </p>
          </CardContent>
        </Card>

        {/* Core Values */}
        <section className="mb-16">
          <h2 className="text-4xl font-bold text-center mb-12 text-slate-900">Our Values</h2>

          <div className="grid md:grid-cols-3 gap-8">
            {values.map((value, index) => {
              const Icon = value.icon
              return (
                <Card
                  key={index}
                  className="text-center border-0 bg-white shadow-lg hover:shadow-xl transition-shadow duration-300"
                >
                  <CardHeader>
                    <div
                      className={`w-16 h-16 rounded-full bg-gradient-to-r ${value.color} flex items-center justify-center mx-auto mb-4`}
                    >
                      <Icon className="h-8 w-8 text-white" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-slate-900">{value.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600 leading-relaxed">{value.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        {/* What is UJAMAA */}
        <section className="mb-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6 text-slate-900">What is UJAMAA?</h2>
              <div className="space-y-4 text-lg text-slate-600 leading-relaxed">
                <p>
                  <strong>UJAMAA</strong> is a Swahili word meaning "familyhood" or "socialism," representing the
                  African philosophy of collective responsibility and shared prosperity.
                </p>
                <p>
                  Our DAO (Decentralized Autonomous Organization) brings this concept into the digital age, creating a
                  platform where African communities can govern themselves transparently, make collective decisions, and
                  build shared wealth.
                </p>
                <p>
                  Through blockchain technology, we ensure that every voice is heard, every vote is counted, and every
                  contribution is recognized and rewarded.
                </p>
              </div>
            </div>

            <Card className="border-0 bg-gradient-to-br from-green-50 to-orange-50">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold mb-4 text-slate-900">Key Principles</h3>
                <ul className="space-y-3">
                  {[
                    "Transparent governance through blockchain",
                    "Community-driven decision making",
                    "Equitable distribution of resources",
                    "Recognition of individual contributions",
                    "Environmental sustainability",
                    "Cultural preservation and celebration",
                  ].map((principle, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-full" />
                      <span className="text-slate-700">{principle}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Features Grid */}
        <section className="mb-16">
          <h2 className="text-4xl font-bold text-center mb-12 text-slate-900">Our Features</h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Card key={index} className="border-0 bg-white hover:shadow-lg transition-shadow duration-300">
                  <CardHeader>
                    <Icon className="h-8 w-8 text-orange-500 mb-3" />
                    <CardTitle className="text-xl font-bold text-slate-900">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600">{feature.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        {/* How to Join */}
        <section className="mb-16">
          <Card className="border-0 bg-gradient-to-br from-orange-500 via-red-500 to-green-500 text-white">
            <CardContent className="p-12 text-center">
              <h2 className="text-4xl font-bold mb-6">Join Us</h2>
              <p className="text-xl mb-8 max-w-2xl mx-auto">
                Ready to be part of Africa's digital transformation? Connect your wallet and start participating in our
                community governance today.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/">
                  <Button size="lg" className="bg-white text-orange-600 hover:bg-orange-50 px-8 py-3 text-lg">
                    Get Started
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-white text-white hover:bg-white hover:text-orange-600 px-8 py-3 text-lg"
                  >
                    Enter Dashboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Footer Quote */}
        <div className="text-center">
          <blockquote className="text-2xl font-medium text-slate-600 italic">
            "Unity is strength, division is weakness"
          </blockquote>
          <p className="text-lg text-slate-500 mt-2">African Proverb</p>
        </div>
      </div>
    </div>
  )
}
