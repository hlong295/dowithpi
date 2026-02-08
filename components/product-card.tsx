import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, CheckCircle2, Star, ShoppingCart, Sprout } from "lucide-react"
import type { ReactNode } from "react"

interface ProductCardProps {
  id: string
  name: string
  location: string
  price: string
  piPrice?: string
  originalPrice?: string
  discount?: number
  verified?: boolean
  rating?: number
  sold?: number
  icon?: ReactNode
  showDiscount?: boolean
}

export function ProductCard({
  id,
  name,
  location,
  price,
  piPrice,
  originalPrice,
  discount,
  verified = false,
  rating,
  sold,
  icon,
  showDiscount = false
}: ProductCardProps) {
  return (
    <Link href={`/nong-san/chi-tiet?id=${id}`} prefetch={true}>
      <Card className="bg-white border-0 overflow-hidden hover:shadow-lg transition-all cursor-pointer group active:scale-[0.98] rounded-[20px] shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
        {/* Image area - 4:3 aspect ratio matching mockup */}
        <div className="relative m-2.5 mb-0">
          <div className="aspect-[4/3] bg-gradient-to-br from-[#f0f7ee] to-[#e8f4e5] flex items-center justify-center rounded-[14px] overflow-hidden">
            {icon || <Sprout className="h-14 w-14 text-[#4CAF50]/15 group-hover:scale-110 transition-transform" />}
          </div>
          
          {/* Top-left: Discount badge - 12px -> 8px, h-26 -> h-18 */}
          {showDiscount && discount && (
            <Badge className="absolute top-1.5 left-1.5 h-[18px] bg-[#E8533E] text-white text-[8px] px-1.5 font-bold shadow-md rounded-full border-0">
              ~{discount}%
            </Badge>
          )}
          
          {/* Top-right: Verified badge - 12px -> 8px, icon 3.5 -> 2.5 */}
          {verified && (
            <Badge className="absolute top-1.5 right-1.5 h-[18px] bg-[#4CAF50] text-white text-[8px] px-1.5 font-semibold shadow-md flex items-center gap-0.5 rounded-full border-0">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Verified
            </Badge>
          )}
        </div>

        <CardContent className="px-2.5 pt-2 pb-2.5 space-y-0.5">
          {/* Product name - 16px -> 11px (70%) */}
          <h3 className="font-bold text-[11px] leading-[15px] line-clamp-1 group-hover:text-[#4CAF50] transition-colors text-[#1a1a1a]">
            {name}
          </h3>
          
          {/* Location - 13px -> 9px (70%), icon 4->3 */}
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full border border-gray-400 flex items-center justify-center shrink-0">
              <MapPin className="h-1.5 w-1.5 text-gray-500" />
            </div>
            <span className="text-[9px] leading-[12px] text-gray-500 line-clamp-1">{location}</span>
          </div>
          
          {/* Price + Rating row - 18px -> 13px, icon 4->3 */}
          <div className="flex items-center justify-between gap-1.5 pt-0.5">
            <p className="text-[13px] leading-[16px] font-bold text-red-600">{price}</p>
            {rating && (
              <div className="flex items-center gap-0.5 shrink-0">
                <Star className="h-3 w-3 fill-[#F5A623] text-[#F5A623]" />
                <span className="text-[10px] leading-[12px] font-semibold text-[#333]">{rating}</span>
              </div>
            )}
          </div>
          
          {/* Pi price - 13px -> 9px, color purple */}
          {piPrice && (
            <p className="text-[9px] leading-[12px] text-[#6D2D91] font-semibold">π {piPrice}</p>
          )}
          {originalPrice && !piPrice && (
            <p className="text-[9px] leading-[12px] text-gray-400 line-through">{originalPrice}</p>
          )}
          
          {/* Bottom row: Sold count + Buy button - 13px -> 9px, button 34px -> 24px */}
          <div className="flex items-center justify-between pt-1">
            {sold !== undefined ? (
              <p className="text-[9px] leading-[12px] text-gray-500">Đã bán {sold}</p>
            ) : (
              <span />
            )}
            <Button className="h-[24px] px-2.5 bg-[#4CAF50] hover:bg-[#43a047] text-white text-[9px] font-semibold transition-all active:scale-95 rounded-full shadow-sm">
              <ShoppingCart className="h-2.5 w-2.5 mr-1" />
              Mua ngay
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
