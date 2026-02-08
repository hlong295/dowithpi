"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppHeader } from "@/components/app-header"
import { AppFooter } from "@/components/app-footer"
import {
  Leaf,
  Sprout,
  MapPin,
  Calendar,
  CheckCircle2,
  ArrowRight,
  ThumbsUp,
  Eye,
  Play
} from "lucide-react"

interface RecoveryCase {
  id: string
  title: string
  category: "soil" | "crop" | "livestock"
  location: string
  date: string
  summary: string
  hasVideo: boolean
  likes: number
  views: number
  verified: boolean
}

const recoveryCases: RecoveryCase[] = [
  {
    id: "CV001",
    title: "Phục hồi đất nhiễm phèn tại Đồng Tháp",
    category: "soil",
    location: "Đồng Tháp",
    date: "15/01/2024",
    summary: "Sau 6 tháng sử dụng TSBIO, độ pH đất tăng từ 4.2 lên 6.5, năng suất lúa tăng 30%",
    hasVideo: true,
    likes: 128,
    views: 1542,
    verified: true
  },
  {
    id: "CV002",
    title: "Cứu vườn cam sành bị vàng lá",
    category: "crop",
    location: "Hậu Giang",
    date: "10/01/2024",
    summary: "Xử lý bệnh vàng lá bằng vi sinh, 80% cây phục hồi sau 2 tháng",
    hasVideo: false,
    likes: 95,
    views: 1203,
    verified: true
  },
  {
    id: "CV003",
    title: "Phục hồi ao cá nhiễm độc",
    category: "livestock",
    location: "Cần Thơ",
    date: "08/01/2024",
    summary: "Cải thiện chất lượng nước ao nuôi bằng vi sinh xử lý nước TSBIO",
    hasVideo: true,
    likes: 156,
    views: 2103,
    verified: true
  },
  {
    id: "CV004",
    title: "Cải tạo đất trồng rau sạch",
    category: "soil",
    location: "Đà Lạt, Lâm Đồng",
    date: "05/01/2024",
    summary: "Tăng độ phì nhiêu đất, giảm 50% phân bón hóa học",
    hasVideo: false,
    likes: 87,
    views: 982,
    verified: true
  },
  {
    id: "CV005",
    title: "Khắc phục bệnh héo xanh cà chua",
    category: "crop",
    location: "Lâm Đồng",
    date: "02/01/2024",
    summary: "Sử dụng vi sinh đối kháng, 90% diện tích cà chua phục hồi",
    hasVideo: true,
    likes: 142,
    views: 1876,
    verified: true
  },
  {
    id: "CV006",
    title: "Cải thiện sức khỏe đàn gà",
    category: "livestock",
    location: "Long An",
    date: "28/12/2023",
    summary: "Bổ sung vi sinh vào thức ăn, tỷ lệ sống tăng 25%",
    hasVideo: false,
    likes: 73,
    views: 756,
    verified: true
  }
]

const categoryLabels = {
  soil: "Cứu đất",
  crop: "Cứu vườn",
  livestock: "Chăn nuôi"
}

const categoryColors = {
  soil: "bg-amber-100 text-amber-700",
  crop: "bg-green-100 text-green-700",
  livestock: "bg-blue-100 text-blue-700"
}

export default function CuuVuonPage() {
  return (
    <>
      <style jsx global>{`
        [data-state="active"].rescue-tab {
          background: #F4B740 !important;
          color: #3D2817 !important;
        }
        [data-state="inactive"].rescue-tab {
          background: transparent !important;
          color: white !important;
        }
      `}</style>
      <div className="min-h-screen bg-white pb-24 w-full max-w-full overflow-x-hidden" style={{ opacity: 1, filter: 'none' }}>
        <AppHeader />

      <main className="px-3 py-5 space-y-6 w-full max-w-[430px] mx-auto pt-[calc(3.5rem+1.25rem)]" style={{ opacity: 1, filter: 'none' }}>
        {/* Header Section */}
        <section className="space-y-1.5">
          <h1 className="text-lg font-semibold text-foreground">Cứu vườn – Cứu đất</h1>
          <p className="text-xs text-muted-foreground leading-relaxed font-light">
            Những câu chuyện thực tế về phục hồi đất, cây trồng và vật nuôi bằng TSBIO
          </p>
        </section>

        {/* Category Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-9 border border-border/50" style={{ background: '#2FA84F' }}>
            <TabsTrigger 
              value="all" 
              className="rescue-tab text-xs font-medium"
            >
              Tất cả
            </TabsTrigger>
            <TabsTrigger 
              value="soil" 
              className="rescue-tab text-xs font-medium"
            >
              Cứu đất
            </TabsTrigger>
            <TabsTrigger 
              value="crop" 
              className="rescue-tab text-xs font-medium"
            >
              Cứu vườn
            </TabsTrigger>
            <TabsTrigger 
              value="livestock" 
              className="rescue-tab text-xs font-medium"
            >
              Chăn nuôi
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-3 mt-4">
            <div className="space-y-3">
              {recoveryCases.map((caseItem) => (
                <Card key={caseItem.id} className="bg-white border-border/50 overflow-hidden cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all">
                  <CardContent className="p-3">
                    <div className="flex gap-3">
                      {/* Thumbnail */}
                      <div className="w-24 h-24 bg-secondary/30 rounded-lg flex items-center justify-center shrink-0 relative">
                        <Sprout className="h-8 w-8 text-muted-foreground/20" />
                        {caseItem.hasVideo && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                            <Play className="h-6 w-6 text-white" fill="white" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-xs leading-snug line-clamp-2">
                            {caseItem.title}
                          </h3>
                          {caseItem.verified && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          )}
                        </div>

                        <Badge className={`text-[9px] h-4 px-1.5 font-medium ${categoryColors[caseItem.category]}`}>
                          {categoryLabels[caseItem.category]}
                        </Badge>

                        <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 font-light">
                          {caseItem.summary}
                        </p>

                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-light">
                          <div className="flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" />
                            <span>{caseItem.location}</span>
                          </div>
                          <span>•</span>
                          <div className="flex items-center gap-0.5">
                            <Calendar className="h-3 w-3" />
                            <span>{caseItem.date}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-light">
                          <div className="flex items-center gap-0.5">
                            <Eye className="h-3 w-3" />
                            <span>{caseItem.views}</span>
                          </div>
                          <span>•</span>
                          <div className="flex items-center gap-0.5">
                            <ThumbsUp className="h-3 w-3" />
                            <span>{caseItem.likes}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="soil" className="space-y-3 mt-4">
            <div className="space-y-3">
              {recoveryCases.filter(c => c.category === "soil").map((caseItem) => (
                <Card key={caseItem.id} className="bg-white border-border/50 overflow-hidden cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all">
                  <CardContent className="p-3">
                    <div className="flex gap-3">
                      <div className="w-24 h-24 bg-secondary/50 rounded-lg flex items-center justify-center shrink-0 relative">
                        <Sprout className="h-8 w-8 text-muted-foreground/30" />
                        {caseItem.hasVideo && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                            <Play className="h-6 w-6 text-white" fill="white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-xs leading-tight line-clamp-2">
                            {caseItem.title}
                          </h3>
                          {caseItem.verified && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                          {caseItem.summary}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5" />
                            <span>{caseItem.location}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5" />
                            <span>{caseItem.date}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="crop" className="space-y-3 mt-4">
            <div className="space-y-3">
              {recoveryCases.filter(c => c.category === "crop").map((caseItem) => (
                <Card key={caseItem.id} className="bg-white border-border/50 overflow-hidden cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all">
                  <CardContent className="p-3">
                    <div className="flex gap-3">
                      <div className="w-24 h-24 bg-secondary/50 rounded-lg flex items-center justify-center shrink-0 relative">
                        <Sprout className="h-8 w-8 text-muted-foreground/30" />
                        {caseItem.hasVideo && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                            <Play className="h-6 w-6 text-white" fill="white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-xs leading-tight line-clamp-2">
                            {caseItem.title}
                          </h3>
                          {caseItem.verified && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                          {caseItem.summary}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5" />
                            <span>{caseItem.location}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5" />
                            <span>{caseItem.date}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="livestock" className="space-y-3 mt-4">
            <div className="space-y-3">
              {recoveryCases.filter(c => c.category === "livestock").map((caseItem) => (
                <Card key={caseItem.id} className="bg-white border-border/50 overflow-hidden cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all">
                  <CardContent className="p-3">
                    <div className="flex gap-3">
                      <div className="w-24 h-24 bg-secondary/50 rounded-lg flex items-center justify-center shrink-0 relative">
                        <Sprout className="h-8 w-8 text-muted-foreground/30" />
                        {caseItem.hasVideo && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                            <Play className="h-6 w-6 text-white" fill="white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-xs leading-tight line-clamp-2">
                            {caseItem.title}
                          </h3>
                          {caseItem.verified && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
                          {caseItem.summary}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5" />
                            <span>{caseItem.location}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5" />
                            <span>{caseItem.date}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Practical Guide Section */}
        <section className="space-y-3 border-t border-border/50 pt-4">
          <h2 className="text-sm font-semibold text-foreground">Hướng dẫn thực hành</h2>
          <Card className="bg-white border-border/50">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Leaf className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-xs mb-1">Cách sử dụng TSBIO hiệu quả</h3>
                  <p className="text-[10px] text-muted-foreground leading-relaxed font-light">
                    Hướng dẫn chi tiết về liều lượng, thời gian và cách thức sử dụng sản phẩm TSBIO để đạt hiệu quả cao nhất
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <AppFooter />
      </div>
    </>
  )
}
