"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppHeader } from "@/components/app-header"
import { AppFooter } from "@/components/app-footer"
import {
  Newspaper,
  Clock,
  Eye,
  Bookmark,
  TrendingUp,
  Lightbulb,
  Sprout
} from "lucide-react"

interface NewsArticle {
  id: string
  title: string
  category: "knowledge" | "experience" | "market"
  excerpt: string
  date: string
  readTime: string
  views: number
  featured: boolean
}

const newsArticles: NewsArticle[] = [
  {
    id: "TT001",
    title: "Vi sinh vật có lợi trong nông nghiệp hữu cơ",
    category: "knowledge",
    excerpt: "Tìm hiểu về vai trò của vi sinh vật trong việc cải thiện độ phì nhiêu đất và tăng năng suất cây trồng",
    date: "20/01/2024",
    readTime: "5 phút",
    views: 2341,
    featured: true
  },
  {
    id: "TT002",
    title: "Kinh nghiệm trồng rau sạch tại Đà Lạt",
    category: "experience",
    excerpt: "Chia sẻ từ nông dân về quy trình canh tác rau sạch bằng TSBIO, đạt năng suất cao và bền vững",
    date: "18/01/2024",
    readTime: "7 phút",
    views: 1876,
    featured: true
  },
  {
    id: "TT003",
    title: "Giá rau củ tăng mạnh trước Tết Nguyên Đán",
    category: "market",
    excerpt: "Thị trường nông sản trong nước và xuất khẩu có nhiều biến động tích cực, giá tăng 15-20%",
    date: "17/01/2024",
    readTime: "4 phút",
    views: 3102,
    featured: true
  },
  {
    id: "TT004",
    title: "Phân bón vi sinh: Lợi ích và cách sử dụng",
    category: "knowledge",
    excerpt: "Hướng dẫn chi tiết về các loại phân bón vi sinh và cách áp dụng hiệu quả trong canh tác",
    date: "15/01/2024",
    readTime: "6 phút",
    views: 1654,
    featured: false
  },
  {
    id: "TT005",
    title: "Mô hình nuôi cá kết hợp trồng rau",
    category: "experience",
    excerpt: "Aquaponics - giải pháp canh tác thông minh, tiết kiệm nước và tăng thu nhập",
    date: "13/01/2024",
    readTime: "8 phút",
    views: 1432,
    featured: false
  },
  {
    id: "TT006",
    title: "Triển vọng xuất khẩu rau quả Việt Nam",
    category: "market",
    excerpt: "Phân tích thị trường xuất khẩu và cơ hội cho nông sản Việt trong năm 2024",
    date: "12/01/2024",
    readTime: "5 phút",
    views: 2187,
    featured: false
  },
  {
    id: "TT007",
    title: "Xử lý bệnh héo xanh bằng vi sinh",
    category: "knowledge",
    excerpt: "Phương pháp sinh học trong phòng trừ bệnh hại cây trồng, an toàn và hiệu quả",
    date: "10/01/2024",
    readTime: "6 phút",
    views: 1923,
    featured: false
  },
  {
    id: "TT008",
    title: "Cách làm đất trồng dâu tây chất lượng cao",
    category: "experience",
    excerpt: "Kinh nghiệm từ các nông trại Đà Lạt về chuẩn bị đất và chăm sóc dâu tây",
    date: "08/01/2024",
    readTime: "7 phút",
    views: 1765,
    featured: false
  },
  {
    id: "TT009",
    title: "Giá cà phê tăng cao kỷ lục",
    category: "market",
    excerpt: "Thị trường cà phê toàn cầu biến động, giá robusta đạt mức cao nhất 10 năm",
    date: "05/01/2024",
    readTime: "4 phút",
    views: 2891,
    featured: false
  }
]

const categoryLabels = {
  knowledge: "Kiến thức vi sinh",
  experience: "Kinh nghiệm canh tác",
  market: "Thị trường nông sản"
}

const categoryIcons = {
  knowledge: Lightbulb,
  experience: Sprout,
  market: TrendingUp
}

const categoryColors = {
  knowledge: "bg-blue-100 text-blue-700",
  experience: "bg-green-100 text-green-700",
  market: "bg-amber-100 text-amber-700"
}

export default function TinTucPage() {
  const ArticleCard = ({ article, featured = false }: { article: NewsArticle, featured?: boolean }) => {
    const CategoryIcon = categoryIcons[article.category]
    
    return (
      <Card className="bg-white border-border/50 overflow-hidden cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all">
        <CardContent className={featured ? "p-3" : "p-3"}>
          <div className="flex gap-3">
            {featured && (
              <div className="w-24 h-24 bg-secondary/50 rounded-lg flex items-center justify-center shrink-0">
                <Newspaper className="h-8 w-8 text-muted-foreground/30" />
              </div>
            )}
            
            <div className="flex-1 space-y-2">
              <Badge className={`text-[9px] h-4 px-1.5 font-medium ${categoryColors[article.category]}`}>
                <CategoryIcon className="h-2.5 w-2.5 mr-0.5" />
                {categoryLabels[article.category]}
              </Badge>

              <h3 className={`font-semibold leading-snug ${featured ? 'text-sm' : 'text-xs'} line-clamp-2 text-pretty`}>
                {article.title}
              </h3>

              <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 font-light">
                {article.excerpt}
              </p>

              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-light">
                <div className="flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />
                  <span>{article.readTime}</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <Eye className="h-3 w-3" />
                  <span>{article.views}</span>
                </div>
                <span>•</span>
                <span>{article.date}</span>
              </div>
            </div>

            <Bookmark className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-white pb-24 w-full max-w-full overflow-x-hidden" style={{ opacity: 1, filter: 'none' }}>
      <AppHeader />

      <main className="px-3 py-5 space-y-6 w-full max-w-[430px] mx-auto pt-[calc(3.5rem+1.25rem)]" style={{ opacity: 1, filter: 'none' }}>
        {/* Header Section */}
        <section className="space-y-1.5">
          <h1 className="text-lg font-semibold text-foreground">Tin tức</h1>
          <p className="text-xs text-muted-foreground leading-relaxed font-light">
            Cập nhật kiến thức, kinh nghiệm và thị trường nông nghiệp
          </p>
        </section>

        {/* Category Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-12 rounded-full p-1 border-0" style={{ background: '#2F8A57' }}>
            <TabsTrigger 
              value="all" 
              className="news-tab text-sm font-medium rounded-full"
            >
              Tất cả
            </TabsTrigger>
            <TabsTrigger 
              value="knowledge" 
              className="news-tab text-sm font-medium rounded-full"
            >
              Kiến thức
            </TabsTrigger>
            <TabsTrigger 
              value="experience" 
              className="news-tab text-sm font-medium rounded-full"
            >
              Kinh nghiệm
            </TabsTrigger>
            <TabsTrigger 
              value="market" 
              className="news-tab text-sm font-medium rounded-full"
            >
              Thị trường
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-6 mt-4">
            {newsArticles.filter(a => a.featured).length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Nổi bật</h2>
                <div className="space-y-3">
                  {newsArticles.filter(a => a.featured).map((article) => (
                    <ArticleCard key={article.id} article={article} featured={true} />
                  ))}
                </div>
              </section>
            )}
            <section className="space-y-3">
              {newsArticles.filter(a => !a.featured).map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </section>
          </TabsContent>

          <TabsContent value="knowledge" className="space-y-6 mt-4">
            {newsArticles.filter(a => a.featured && a.category === "knowledge").length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Nổi bật</h2>
                <div className="space-y-3">
                  {newsArticles.filter(a => a.featured && a.category === "knowledge").map((article) => (
                    <ArticleCard key={article.id} article={article} featured={true} />
                  ))}
                </div>
              </section>
            )}
            <section className="space-y-3">
              {newsArticles.filter(a => !a.featured && a.category === "knowledge").map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </section>
          </TabsContent>

          <TabsContent value="experience" className="space-y-6 mt-4">
            {newsArticles.filter(a => a.featured && a.category === "experience").length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Nổi bật</h2>
                <div className="space-y-3">
                  {newsArticles.filter(a => a.featured && a.category === "experience").map((article) => (
                    <ArticleCard key={article.id} article={article} featured={true} />
                  ))}
                </div>
              </section>
            )}
            <section className="space-y-3">
              {newsArticles.filter(a => !a.featured && a.category === "experience").map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </section>
          </TabsContent>

          <TabsContent value="market" className="space-y-6 mt-4">
            {newsArticles.filter(a => a.featured && a.category === "market").length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Nổi bật</h2>
                <div className="space-y-3">
                  {newsArticles.filter(a => a.featured && a.category === "market").map((article) => (
                    <ArticleCard key={article.id} article={article} featured={true} />
                  ))}
                </div>
              </section>
            )}
            <section className="space-y-3">
              {newsArticles.filter(a => !a.featured && a.category === "market").map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </section>
          </TabsContent>
        </Tabs>
      </main>

      <AppFooter />
    </div>
  )
}
