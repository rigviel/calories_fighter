import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const foodEstimates: Record<string, { calories: number; protein_g: number; carbs_g: number; fat_g: number }> = {
  'rice': { calories: 200, protein_g: 4, carbs_g: 45, fat_g: 0.3 },
  'chicken': { calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 },
  'beef': { calories: 250, protein_g: 26, carbs_g: 0, fat_g: 15 },
  'fish': { calories: 100, protein_g: 20, carbs_g: 0, fat_g: 1 },
  'pasta': { calories: 180, protein_g: 7, carbs_g: 36, fat_g: 1 },
  'bread': { calories: 265, protein_g: 9, carbs_g: 49, fat_g: 3.3 },
  'apple': { calories: 52, protein_g: 0.3, carbs_g: 14, fat_g: 0.2 },
  'banana': { calories: 89, protein_g: 1, carbs_g: 23, fat_g: 0.3 },
  'coffee': { calories: 2, protein_g: 0.3, carbs_g: 0, fat_g: 0 },
  'milk': { calories: 61, protein_g: 3.2, carbs_g: 4.8, fat_g: 3.3 },
  'yogurt': { calories: 59, protein_g: 10, carbs_g: 3.3, fat_g: 0.4 },
  'cheese': { calories: 402, protein_g: 25, carbs_g: 1.3, fat_g: 33 },
  'egg': { calories: 155, protein_g: 13, carbs_g: 1.1, fat_g: 11 },
  'vegetables': { calories: 35, protein_g: 2.6, carbs_g: 7, fat_g: 0.4 },
  'olive oil': { calories: 884, protein_g: 0, carbs_g: 0, fat_g: 100 },
  'butter': { calories: 717, protein_g: 0.9, carbs_g: 0.1, fat_g: 81 },
  'pizza': { calories: 285, protein_g: 12, carbs_g: 36, fat_g: 10 },
  'burger': { calories: 354, protein_g: 30, carbs_g: 28, fat_g: 15 },
  'fries': { calories: 365, protein_g: 3.4, carbs_g: 48, fat_g: 17 },
  'soda': { calories: 41, protein_g: 0, carbs_g: 11, fat_g: 0 },
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { food_description } = await req.json();

    if (!food_description) {
      return new Response(JSON.stringify({ error: 'food_description is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const desc = food_description.toLowerCase();
    let estimate = { calories: 250, protein_g: 12, carbs_g: 30, fat_g: 8 };

    for (const [food, values] of Object.entries(foodEstimates)) {
      if (desc.includes(food)) {
        estimate = values;
        break;
      }
    }

    return new Response(JSON.stringify({
      calories: estimate.calories,
      protein_g: estimate.protein_g,
      carbs_g: estimate.carbs_g,
      fat_g: estimate.fat_g,
      serving_size: '1 serving',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
