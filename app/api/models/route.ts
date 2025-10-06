import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`)
    }

    const data = await response.json()
    
    // Separate models into free and paid
    const freeModels: any[] = []
    const paidModels: any[] = []
    
    data.data?.forEach((model: any) => {
      const isFree = model.pricing?.prompt === "0" && model.pricing?.completion === "0"
      
      const modelInfo = {
        id: model.id,
        name: model.name,
        description: model.description,
        context_length: model.context_length,
        pricing: model.pricing,
        top_provider: model.top_provider,
        architecture: model.architecture,
        canonical_slug: model.canonical_slug,
        supported_parameters: model.supported_parameters,
        default_parameters: model.default_parameters,
      }
      
      if (isFree) {
        freeModels.push(modelInfo)
      } else {
        paidModels.push(modelInfo)
      }
    })
    
    // Sort by name
    freeModels.sort((a, b) => a.name.localeCompare(b.name))
    paidModels.sort((a, b) => a.name.localeCompare(b.name))
    
    return NextResponse.json({
      free: freeModels,
      paid: paidModels,
      total: data.data?.length || 0
    })
    
  } catch (error) {
    console.error("Error fetching models:", error)
    return NextResponse.json(
      { error: "Failed to fetch models" },
      { status: 500 }
    )
  }
}
