import { Noto_Sans_Armenian } from "next/font/google";
import "./globals.css";

const notoSansArmenian = Noto_Sans_Armenian({ subsets: ["armenian", "latin"], weight: ["400", "500", "600", "700"] });

export const metadata = {
  title: "Ադմինիստրատորի վահանակ",
  description: "Telegram և Web ավտոմատացումների կառավարում",
};

export default function RootLayout({ children }) {
  return (
    <html lang="hy">
      <body className={`${notoSansArmenian.className} bg-slate-50 text-slate-900 min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  );
}
