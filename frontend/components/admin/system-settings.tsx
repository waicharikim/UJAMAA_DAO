"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Settings, Shield, DollarSign, Bell, Globe, Lock } from "lucide-react"

export function SystemSettings() {
  const { toast } = useToast()
  const [settings, setSettings] = useState({
    // Governance Settings
    governance: {
      proposalCreationCost: 10,
      votingCost: 2,
      quorumPercentage: 75,
      consensusPercentage: 68,
      votingDuration: 7,
      proposalCooldown: 24,
    },
    // Token Economics
    tokenomics: {
      initialTokenSupply: 1000000,
      mintingEnabled: true,
      burnRate: 0.1,
      stakingRewards: 5,
      impactPointsToTokenRatio: 0.1,
    },
    // Security Settings
    security: {
      twoFactorRequired: false,
      sessionTimeout: 24,
      maxLoginAttempts: 5,
      passwordMinLength: 8,
      requireEmailVerification: true,
    },
    // Notification Settings
    notifications: {
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true,
      digestFrequency: "daily",
      maintenanceAlerts: true,
    },
    // Platform Settings
    platform: {
      maintenanceMode: false,
      registrationOpen: true,
      maxUsersPerGroup: 100,
      maxGroupsPerUser: 10,
      dataRetentionDays: 365,
    },
  })

  const handleSave = (category: string) => {
    // Mock save operation
    toast({
      title: "Settings Updated",
      description: `${category} settings have been saved successfully.`,
    })
  }

  const updateSetting = (category: string, key: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [key]: value,
      },
    }))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            System Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="governance">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="governance">Governance</TabsTrigger>
              <TabsTrigger value="tokenomics">Tokenomics</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="platform">Platform</TabsTrigger>
            </TabsList>

            <TabsContent value="governance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Governance Parameters
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="proposalCost">Proposal Creation Cost (tokens)</Label>
                      <Input
                        id="proposalCost"
                        type="number"
                        value={settings.governance.proposalCreationCost}
                        onChange={(e) =>
                          updateSetting("governance", "proposalCreationCost", Number.parseInt(e.target.value))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="votingCost">Voting Cost (tokens)</Label>
                      <Input
                        id="votingCost"
                        type="number"
                        value={settings.governance.votingCost}
                        onChange={(e) => updateSetting("governance", "votingCost", Number.parseInt(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="quorum">Quorum Percentage (%)</Label>
                      <Input
                        id="quorum"
                        type="number"
                        min="1"
                        max="100"
                        value={settings.governance.quorumPercentage}
                        onChange={(e) =>
                          updateSetting("governance", "quorumPercentage", Number.parseInt(e.target.value))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="consensus">Consensus Percentage (%)</Label>
                      <Input
                        id="consensus"
                        type="number"
                        min="1"
                        max="100"
                        value={settings.governance.consensusPercentage}
                        onChange={(e) =>
                          updateSetting("governance", "consensusPercentage", Number.parseInt(e.target.value))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="votingDuration">Voting Duration (days)</Label>
                      <Input
                        id="votingDuration"
                        type="number"
                        min="1"
                        max="30"
                        value={settings.governance.votingDuration}
                        onChange={(e) => updateSetting("governance", "votingDuration", Number.parseInt(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="cooldown">Proposal Cooldown (hours)</Label>
                      <Input
                        id="cooldown"
                        type="number"
                        min="1"
                        value={settings.governance.proposalCooldown}
                        onChange={(e) =>
                          updateSetting("governance", "proposalCooldown", Number.parseInt(e.target.value))
                        }
                      />
                    </div>
                  </div>
                  <Button onClick={() => handleSave("Governance")}>Save Governance Settings</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tokenomics" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Token Economics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="tokenSupply">Initial Token Supply</Label>
                      <Input
                        id="tokenSupply"
                        type="number"
                        value={settings.tokenomics.initialTokenSupply}
                        onChange={(e) =>
                          updateSetting("tokenomics", "initialTokenSupply", Number.parseInt(e.target.value))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="burnRate">Burn Rate (%)</Label>
                      <Input
                        id="burnRate"
                        type="number"
                        step="0.1"
                        value={settings.tokenomics.burnRate}
                        onChange={(e) => updateSetting("tokenomics", "burnRate", Number.parseFloat(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="stakingRewards">Staking Rewards (% APY)</Label>
                      <Input
                        id="stakingRewards"
                        type="number"
                        value={settings.tokenomics.stakingRewards}
                        onChange={(e) => updateSetting("tokenomics", "stakingRewards", Number.parseInt(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="pointsRatio">Impact Points to Token Ratio</Label>
                      <Input
                        id="pointsRatio"
                        type="number"
                        step="0.01"
                        value={settings.tokenomics.impactPointsToTokenRatio}
                        onChange={(e) =>
                          updateSetting("tokenomics", "impactPointsToTokenRatio", Number.parseFloat(e.target.value))
                        }
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="minting"
                      checked={settings.tokenomics.mintingEnabled}
                      onCheckedChange={(checked) => updateSetting("tokenomics", "mintingEnabled", checked)}
                    />
                    <Label htmlFor="minting">Enable Token Minting</Label>
                  </div>
                  <Button onClick={() => handleSave("Tokenomics")}>Save Token Settings</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Security Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sessionTimeout">Session Timeout (hours)</Label>
                      <Input
                        id="sessionTimeout"
                        type="number"
                        min="1"
                        max="168"
                        value={settings.security.sessionTimeout}
                        onChange={(e) => updateSetting("security", "sessionTimeout", Number.parseInt(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxAttempts">Max Login Attempts</Label>
                      <Input
                        id="maxAttempts"
                        type="number"
                        min="1"
                        max="10"
                        value={settings.security.maxLoginAttempts}
                        onChange={(e) => updateSetting("security", "maxLoginAttempts", Number.parseInt(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="passwordLength">Minimum Password Length</Label>
                      <Input
                        id="passwordLength"
                        type="number"
                        min="6"
                        max="32"
                        value={settings.security.passwordMinLength}
                        onChange={(e) =>
                          updateSetting("security", "passwordMinLength", Number.parseInt(e.target.value))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="twoFactor"
                        checked={settings.security.twoFactorRequired}
                        onCheckedChange={(checked) => updateSetting("security", "twoFactorRequired", checked)}
                      />
                      <Label htmlFor="twoFactor">Require Two-Factor Authentication</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="emailVerification"
                        checked={settings.security.requireEmailVerification}
                        onCheckedChange={(checked) => updateSetting("security", "requireEmailVerification", checked)}
                      />
                      <Label htmlFor="emailVerification">Require Email Verification</Label>
                    </div>
                  </div>
                  <Button onClick={() => handleSave("Security")}>Save Security Settings</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notification Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="digestFreq">Digest Frequency</Label>
                    <Select
                      value={settings.notifications.digestFrequency}
                      onValueChange={(value) => updateSetting("notifications", "digestFrequency", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Immediate</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="emailNotifs"
                        checked={settings.notifications.emailNotifications}
                        onCheckedChange={(checked) => updateSetting("notifications", "emailNotifications", checked)}
                      />
                      <Label htmlFor="emailNotifs">Enable Email Notifications</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="smsNotifs"
                        checked={settings.notifications.smsNotifications}
                        onCheckedChange={(checked) => updateSetting("notifications", "smsNotifications", checked)}
                      />
                      <Label htmlFor="smsNotifs">Enable SMS Notifications</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="pushNotifs"
                        checked={settings.notifications.pushNotifications}
                        onCheckedChange={(checked) => updateSetting("notifications", "pushNotifications", checked)}
                      />
                      <Label htmlFor="pushNotifs">Enable Push Notifications</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="maintenanceAlerts"
                        checked={settings.notifications.maintenanceAlerts}
                        onCheckedChange={(checked) => updateSetting("notifications", "maintenanceAlerts", checked)}
                      />
                      <Label htmlFor="maintenanceAlerts">Maintenance Alerts</Label>
                    </div>
                  </div>
                  <Button onClick={() => handleSave("Notifications")}>Save Notification Settings</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="platform" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Platform Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="maxUsersGroup">Max Users per Group</Label>
                      <Input
                        id="maxUsersGroup"
                        type="number"
                        min="10"
                        max="1000"
                        value={settings.platform.maxUsersPerGroup}
                        onChange={(e) => updateSetting("platform", "maxUsersPerGroup", Number.parseInt(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxGroupsUser">Max Groups per User</Label>
                      <Input
                        id="maxGroupsUser"
                        type="number"
                        min="1"
                        max="50"
                        value={settings.platform.maxGroupsPerUser}
                        onChange={(e) => updateSetting("platform", "maxGroupsPerUser", Number.parseInt(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dataRetention">Data Retention (days)</Label>
                      <Input
                        id="dataRetention"
                        type="number"
                        min="30"
                        max="2555"
                        value={settings.platform.dataRetentionDays}
                        onChange={(e) =>
                          updateSetting("platform", "dataRetentionDays", Number.parseInt(e.target.value))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="maintenance"
                        checked={settings.platform.maintenanceMode}
                        onCheckedChange={(checked) => updateSetting("platform", "maintenanceMode", checked)}
                      />
                      <Label htmlFor="maintenance">Maintenance Mode</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="registration"
                        checked={settings.platform.registrationOpen}
                        onCheckedChange={(checked) => updateSetting("platform", "registrationOpen", checked)}
                      />
                      <Label htmlFor="registration">Open Registration</Label>
                    </div>
                  </div>
                  <Button onClick={() => handleSave("Platform")}>Save Platform Settings</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
