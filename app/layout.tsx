import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import "./globals.css"

import { Geist_Mono as V0_Font_Geist_Mono } from 'next/font/google'

// Initialize fonts
const _geistMono = V0_Font_Geist_Mono({ subsets: ['latin'], weight: ["100","200","300","400","500","600","700","800","900"] })

export const metadata: Metadata = {
  title: "2code - AI Website Generator",
  description: "Build beautiful React + Vite websites using AI. Just describe what you want and watch it come to life.",
  generator: "v0.app",
  icons: {
    icon: "/favicon.ico",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
          <head>
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  // Remove browser extension attributes that cause hydration mismatches
                  (function() {
                    function removeBisSkinChecked() {
                      // Remove from all elements
                      const elements = document.querySelectorAll('[bis_skin_checked]');
                      elements.forEach(el => {
                        el.removeAttribute('bis_skin_checked');
                        // Also remove from any child elements
                        const children = el.querySelectorAll('[bis_skin_checked]');
                        children.forEach(child => child.removeAttribute('bis_skin_checked'));
                      });
                      
                      // Also check document.documentElement
                      if (document.documentElement.hasAttribute('bis_skin_checked')) {
                        document.documentElement.removeAttribute('bis_skin_checked');
                      }
                    }

                    // Remove immediately
                    removeBisSkinChecked();

                    // Remove on DOMContentLoaded
                    document.addEventListener('DOMContentLoaded', function() {
                      removeBisSkinChecked();

                      // Wait for body to be available before observing
                      function waitForBody() {
                        if (document.body) {
                          // Remove on any mutation after DOM is ready
                          if (window.MutationObserver) {
                            const observer = new MutationObserver(function(mutations) {
                              mutations.forEach(function(mutation) {
                                if (mutation.type === 'attributes' && mutation.attributeName === 'bis_skin_checked') {
                                  mutation.target.removeAttribute('bis_skin_checked');
                                }
                                // Also check added nodes
                                if (mutation.type === 'childList') {
                                  mutation.addedNodes.forEach(function(node) {
                                    if (node.nodeType === 1) { // Element node
                                      if (node.hasAttribute && node.hasAttribute('bis_skin_checked')) {
                                        node.removeAttribute('bis_skin_checked');
                                      }
                                      // Check children
                                      const children = node.querySelectorAll ? node.querySelectorAll('[bis_skin_checked]') : [];
                                      children.forEach(child => child.removeAttribute('bis_skin_checked'));
                                    }
                                  });
                                }
                              });
                            });
                            
                            observer.observe(document.body, {
                              attributes: true,
                              childList: true,
                              subtree: true,
                              attributeFilter: ['bis_skin_checked']
                            });
                          }
                        } else {
                          // Retry after a short delay
                          setTimeout(waitForBody, 10);
                        }
                      }
                      
                      waitForBody();
                    });

                    // Also remove on window load
                    window.addEventListener('load', removeBisSkinChecked);
                  })();
                `,
              }}
            />
          </head>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`} suppressHydrationWarning>
        <Suspense fallback={null}>{children}</Suspense>
        <Analytics />
      </body>
    </html>
  )
}
