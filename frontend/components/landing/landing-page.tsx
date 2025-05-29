"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ConnectWallet } from "@/components/auth/connect-wallet"
import { useAuth } from "@/contexts/auth-context"
import {
  Users,
  Vote,
  Coins,
  Shield,
  Award,
  ArrowRight,
  Star,
  TreePine,
  Target,
  ChevronRight,
  Heart,
} from "lucide-react"

const features = [
  {
    icon: Vote,
    title: "Democratic Governance",
    subtitle: "Transparent Decision Making",
    description:
      "Participate in transparent, blockchain-based voting and proposal systems that embody the spirit of community cooperation.",
    color: "from-orange-500 to-red-500",
  },
  {
    icon: Users,
    title: "Community Groups",
    subtitle: "Ubuntu Networks",
    description:
      "Join location-based groups that reflect our diverse African communities, fostering Ubuntu and collective growth.",
    color: "from-green-500 to-emerald-500",
  },
  {
    icon: Coins,
    title: "Shared Economy",
    subtitle: "Community Tokens",
    description:
      "Earn and spend community tokens through meaningful contributions, building wealth together as one people.",
    color: "from-yellow-500 to-orange-500",
  },
  {
    icon: Award,
    title: "Impact Recognition",
    subtitle: "Contribution Rewards",
    description:
      "Get recognized for positive community impact with our point system that celebrates African values of giving back.",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: Shield,
    title: "Digital Security",
    subtitle: "Blockchain Protection",
    description:
      "Built on secure blockchain technology that protects our community's interests and maintains transparency.",
    color: "from-blue-500 to-indigo-500",
  },
  {
    icon: TreePine,
    title: "Environmental Focus",
    subtitle: "Sustainable Development",
    description: "Support eco-friendly projects that protect our beautiful African landscape for future generations.",
    color: "from-green-600 to-teal-500",
  },
]

const stats = [
  { label: "Active Members", value: "2,847", icon: Users },
  { label: "Proposals", value: "156", icon: Vote },
  { label: "Projects", value: "89", icon: Target },
  { label: "Tokens Distributed", value: "1.2M", icon: Coins },
]

const testimonials = [
  {
    name: "Amina Wanjiku",
    role: "Community Leader",
    location: "Nairobi, Kenya",
    content:
      "UJAMAA has transformed how our community makes decisions. The transparency and inclusivity reflect our true African values.",
    avatar: "AW",
  },
  {
    name: "Kwame Asante",
    role: "Social Entrepreneur",
    location: "Accra, Ghana",
    content:
      "Through UJAMAA, I've connected with like-minded individuals across Africa. Together, we're building something beautiful.",
    avatar: "KA",
  },
  {
    name: "Fatima Diallo",
    role: "Teacher & Activist",
    location: "Lagos, Nigeria",
    content:
      "The impact point system motivates me to contribute more to my community. It's like digital community building!",
    avatar: "FD",
  },
]

const coreValues = [
  {
    icon: Heart,
    title: "Ubuntu",
    description: "I am because we are - our interconnectedness defines us",
    color: "from-red-500 to-pink-500",
  },
  {
    icon: Users,
    title: "Harambee",
    description: "Pulling together - collective effort for community progress",
    color: "from-orange-500 to-yellow-500",
  },
  {
    icon: TreePine,
    title: "Sustainability",
    description: "Environmental stewardship - caring for our shared home",
    color: "from-green-500 to-emerald-500",
  },
]

export function LandingPage() {
  const { isAuthenticated } = useAuth()
  const [activeFeature, setActiveFeature] = useState(0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-transparent to-green-500/10" />
        <div className="container mx-auto px-4 py-20 relative">
          <div className="text-center max-w-4xl mx-auto">
            <Badge className="mb-6 bg-gradient-to-r from-orange-500 to-red-500 text-white border-0">
              🌍 African Digital Community DAO
            </Badge>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-orange-600 via-red-600 to-green-600 bg-clip-text text-transparent">
              UJAMAA
            </h1>

            <p className="text-xl md:text-2xl text-slate-600 mb-4 font-medium">
              Decentralized Community Governance for Africa
            </p>

            <p className="text-lg text-slate-500 mb-8 max-w-2xl mx-auto">
              A Decentralized Autonomous Organization (DAO) that brings together African communities through blockchain
              technology, embodying the spirit of Ubuntu: <em>"I am because we are"</em>
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              {isAuthenticated ? (
                <Link href="/dashboard">
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-8 py-3 text-lg"
                  >
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4">
                  <ConnectWallet />
                  <Link href="/about">
                    <Button
                      variant="outline"
                      size="lg"
                      className="border-orange-500 text-orange-600 hover:bg-orange-50 px-8 py-3 text-lg"
                    >
                      Learn More
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {stats.map((stat, index) => {
                const Icon = stat.icon
                return (
                  <div
                    key={index}
                    className="text-center p-4 rounded-lg bg-white/50 backdrop-blur-sm border border-orange-100"
                  >
                    <Icon className="h-6 w-6 text-orange-500 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                    <div className="text-sm font-medium text-slate-600">{stat.label}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Core Values Section */}
      <section className="py-20 bg-gradient-to-br from-green-50 to-yellow-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Our Foundation</h2>
            <p className="text-xl text-slate-600">
              Built on African values that have guided communities for generations
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {coreValues.map((value, index) => {
              const Icon = value.icon
              return (
                <Card key={index} className="text-center border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardHeader>
                    <div
                      className={`h-16 w-16 rounded-full bg-gradient-to-br ${value.color} flex items-center justify-center mx-auto mb-4`}
                    >
                      <Icon className="h-8 w-8 text-white" />
                    </div>
                    <CardTitle className="text-xl">{value.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600">{value.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Powerful Features</h2>
            <p className="text-xl text-slate-600">
              Everything you need to participate in and manage community governance
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Card
                  key={index}
                  className="group hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-white to-slate-50 hover:scale-105"
                  onMouseEnter={() => setActiveFeature(index)}
                >
                  <CardHeader>
                    <div
                      className={`w-12 h-12 rounded-lg bg-gradient-to-r ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-xl font-bold text-slate-900">{feature.title}</CardTitle>
                    <CardDescription className="text-sm font-medium text-orange-600">
                      {feature.subtitle}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gradient-to-br from-orange-50 to-green-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">How It Works</h2>
            <p className="text-xl text-slate-600">Simple steps to join our digital community</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "01",
                title: "Connect Wallet",
                description: "Connect your Web3 wallet to join our secure blockchain community",
                icon: Shield,
              },
              {
                step: "02",
                title: "Join a Group",
                description: "Find and join your local group or create a new community initiative",
                icon: Users,
              },
              {
                step: "03",
                title: "Participate & Vote",
                description: "Engage in governance, vote on proposals, and earn impact points",
                icon: Vote,
              },
            ].map((step, index) => {
              const Icon = step.icon
              return (
                <div key={index} className="text-center relative">
                  <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-6">
                    {step.step}
                  </div>
                  <Icon className="h-8 w-8 text-orange-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold mb-2 text-slate-900">{step.title}</h3>
                  <p className="text-slate-600">{step.description}</p>

                  {index < 2 && (
                    <div className="hidden md:block absolute top-8 left-full w-full">
                      <ArrowRight className="h-6 w-6 text-orange-300 mx-auto" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4 text-slate-900">Community Voices</h2>
            <p className="text-xl text-slate-600">Hear from our active community members across Africa</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 bg-gradient-to-br from-orange-50 to-white">
                <CardContent className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white font-bold mr-4">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{testimonial.name}</div>
                      <div className="text-sm text-orange-600">{testimonial.role}</div>
                      <div className="text-xs text-slate-500">{testimonial.location}</div>
                    </div>
                  </div>
                  <p className="text-slate-600 italic">"{testimonial.content}"</p>
                  <div className="flex text-yellow-400 mt-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-orange-500 via-red-500 to-green-500">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6 text-white">Join UJAMAA Today</h2>
          <p className="text-xl text-orange-100 mb-8 max-w-2xl mx-auto">
            Be part of Africa's digital transformation. Together, we build stronger, more connected communities.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button
                  size="lg"
                  className="bg-white text-orange-600 hover:bg-orange-50 px-8 py-3 text-lg font-semibold"
                >
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <>
                <ConnectWallet />
                <Link href="/about">
                  <Button
                    variant="outline"
                    size="lg"
                    className="border-white text-white hover:bg-white hover:text-orange-600 px-8 py-3 text-lg"
                  >
                    Read More
                    <ChevronRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </>
            )}
          </div>

          <div className="mt-12 text-center">
            <p className="text-orange-100 text-sm">"Unity is strength, division is weakness" - African Proverb</p>
          </div>
        </div>
      </section>
    </div>
  )
}
