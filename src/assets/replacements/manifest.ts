/**
 * Bundled replacement images for NSFW image blocking.
 * 60 images: cute animals + mouth-watering food.
 * All sourced from Pexels (free license, no attribution required).
 */

export type AspectBucket = 'landscape' | 'portrait' | 'square';

export interface FallbackImage {
  path: string;
  bucket: AspectBucket;
  alt: string;
}

export const FALLBACK_IMAGES: Record<AspectBucket, FallbackImage[]> = {
  landscape: [
    // Animals
    {
      path: 'src/assets/replacements/landscape/corgi-smile.webp',
      bucket: 'landscape',
      alt: 'Happy corgi smiling',
    },
    {
      path: 'src/assets/replacements/landscape/golden-retriever-field.webp',
      bucket: 'landscape',
      alt: 'Golden retriever in a field',
    },
    {
      path: 'src/assets/replacements/landscape/cat-on-fence.webp',
      bucket: 'landscape',
      alt: 'Cat sitting on a fence',
    },
    {
      path: 'src/assets/replacements/landscape/dog-on-beach.webp',
      bucket: 'landscape',
      alt: 'Dog running on the beach',
    },
    {
      path: 'src/assets/replacements/landscape/bunny-rabbit.webp',
      bucket: 'landscape',
      alt: 'Fluffy bunny rabbit',
    },
    {
      path: 'src/assets/replacements/landscape/red-panda.webp',
      bucket: 'landscape',
      alt: 'Adorable red panda',
    },
    {
      path: 'src/assets/replacements/landscape/flamingos-lake.webp',
      bucket: 'landscape',
      alt: 'Pink flamingos at a lake',
    },
    {
      path: 'src/assets/replacements/landscape/seal-beach.webp',
      bucket: 'landscape',
      alt: 'Seal resting on the beach',
    },
    {
      path: 'src/assets/replacements/landscape/otter-swimming.webp',
      bucket: 'landscape',
      alt: 'Otter swimming in water',
    },
    {
      path: 'src/assets/replacements/landscape/baby-elephant.webp',
      bucket: 'landscape',
      alt: 'Baby elephant walking',
    },
    {
      path: 'src/assets/replacements/landscape/dolphins-ocean.webp',
      bucket: 'landscape',
      alt: 'Dolphins jumping in the ocean',
    },
    // Food
    {
      path: 'src/assets/replacements/landscape/pizza-fresh.webp',
      bucket: 'landscape',
      alt: 'Fresh hot pizza',
    },
    {
      path: 'src/assets/replacements/landscape/burger-fries.webp',
      bucket: 'landscape',
      alt: 'Juicy burger with fries',
    },
    {
      path: 'src/assets/replacements/landscape/fruit-platter.webp',
      bucket: 'landscape',
      alt: 'Colorful fruit platter',
    },
    {
      path: 'src/assets/replacements/landscape/sushi-plate.webp',
      bucket: 'landscape',
      alt: 'Sushi platter assortment',
    },
    {
      path: 'src/assets/replacements/landscape/macarons-colorful.webp',
      bucket: 'landscape',
      alt: 'Colorful French macarons',
    },
    {
      path: 'src/assets/replacements/landscape/tacos-spread.webp',
      bucket: 'landscape',
      alt: 'Delicious taco spread',
    },
    {
      path: 'src/assets/replacements/landscape/breakfast-spread.webp',
      bucket: 'landscape',
      alt: 'Breakfast spread on a table',
    },
    {
      path: 'src/assets/replacements/landscape/bbq-ribs.webp',
      bucket: 'landscape',
      alt: 'Smoky BBQ ribs',
    },
    {
      path: 'src/assets/replacements/landscape/cupcakes-row.webp',
      bucket: 'landscape',
      alt: 'Row of frosted cupcakes',
    },
  ],
  portrait: [
    // Animals
    {
      path: 'src/assets/replacements/portrait/pug-blanket.webp',
      bucket: 'portrait',
      alt: 'Pug wrapped in a blanket',
    },
    {
      path: 'src/assets/replacements/portrait/cat-eyes-closeup.webp',
      bucket: 'portrait',
      alt: 'Cat with bright eyes',
    },
    {
      path: 'src/assets/replacements/portrait/golden-retriever-portrait.webp',
      bucket: 'portrait',
      alt: 'Golden retriever portrait',
    },
    {
      path: 'src/assets/replacements/portrait/parrot-colorful.webp',
      bucket: 'portrait',
      alt: 'Colorful parrot perched',
    },
    {
      path: 'src/assets/replacements/portrait/deer-forest.webp',
      bucket: 'portrait',
      alt: 'Deer in a forest',
    },
    {
      path: 'src/assets/replacements/portrait/owl-stare.webp',
      bucket: 'portrait',
      alt: 'Owl with a piercing gaze',
    },
    {
      path: 'src/assets/replacements/portrait/cat-sleeping.webp',
      bucket: 'portrait',
      alt: 'Cat sleeping peacefully',
    },
    {
      path: 'src/assets/replacements/portrait/hamster-fluffy.webp',
      bucket: 'portrait',
      alt: 'Fluffy hamster',
    },
    {
      path: 'src/assets/replacements/portrait/corgi-portrait.webp',
      bucket: 'portrait',
      alt: 'Corgi looking at camera',
    },
    {
      path: 'src/assets/replacements/portrait/panda-bamboo.webp',
      bucket: 'portrait',
      alt: 'Panda munching bamboo',
    },
    {
      path: 'src/assets/replacements/portrait/hedgehog-portrait.webp',
      bucket: 'portrait',
      alt: 'Cute hedgehog closeup',
    },
    // Food
    {
      path: 'src/assets/replacements/portrait/salad-bowl-fresh.webp',
      bucket: 'portrait',
      alt: 'Fresh salad bowl',
    },
    {
      path: 'src/assets/replacements/portrait/waffles-berries.webp',
      bucket: 'portrait',
      alt: 'Waffles topped with berries',
    },
    {
      path: 'src/assets/replacements/portrait/coffee-latte-art.webp',
      bucket: 'portrait',
      alt: 'Latte with beautiful art',
    },
    {
      path: 'src/assets/replacements/portrait/chocolate-cake.webp',
      bucket: 'portrait',
      alt: 'Rich chocolate cake',
    },
    {
      path: 'src/assets/replacements/portrait/ice-cream-cone.webp',
      bucket: 'portrait',
      alt: 'Ice cream cone scoops',
    },
    {
      path: 'src/assets/replacements/portrait/brownie-stack.webp',
      bucket: 'portrait',
      alt: 'Stack of fudgy brownies',
    },
    {
      path: 'src/assets/replacements/portrait/spaghetti-plate.webp',
      bucket: 'portrait',
      alt: 'Plate of spaghetti',
    },
    {
      path: 'src/assets/replacements/portrait/cheesecake-slice.webp',
      bucket: 'portrait',
      alt: 'Creamy cheesecake slice',
    },
    {
      path: 'src/assets/replacements/portrait/ramen-noodles.webp',
      bucket: 'portrait',
      alt: 'Steaming bowl of ramen',
    },
  ],
  square: [
    // Animals
    {
      path: 'src/assets/replacements/square/tabby-cat-cozy.webp',
      bucket: 'square',
      alt: 'Cozy tabby cat',
    },
    {
      path: 'src/assets/replacements/square/kittens-playing.webp',
      bucket: 'square',
      alt: 'Kittens playing together',
    },
    {
      path: 'src/assets/replacements/square/squirrel-acorn.webp',
      bucket: 'square',
      alt: 'Squirrel holding an acorn',
    },
    {
      path: 'src/assets/replacements/square/puppy-golden.webp',
      bucket: 'square',
      alt: 'Golden puppy face',
    },
    {
      path: 'src/assets/replacements/square/panda-eating.webp',
      bucket: 'square',
      alt: 'Panda eating bamboo',
    },
    {
      path: 'src/assets/replacements/square/hedgehog-cute.webp',
      bucket: 'square',
      alt: 'Cute little hedgehog',
    },
    {
      path: 'src/assets/replacements/square/duckling-pond.webp',
      bucket: 'square',
      alt: 'Duckling by a pond',
    },
    {
      path: 'src/assets/replacements/square/corgi-butt.webp',
      bucket: 'square',
      alt: 'Adorable corgi',
    },
    {
      path: 'src/assets/replacements/square/pug-cozy-sq.webp',
      bucket: 'square',
      alt: 'Cozy pug snuggling',
    },
    {
      path: 'src/assets/replacements/square/cat-eyes-sq.webp',
      bucket: 'square',
      alt: 'Cat with big eyes',
    },
    {
      path: 'src/assets/replacements/square/parrot-sq.webp',
      bucket: 'square',
      alt: 'Bright parrot closeup',
    },
    {
      path: 'src/assets/replacements/square/deer-sq.webp',
      bucket: 'square',
      alt: 'Deer in the wild',
    },
    // Food
    {
      path: 'src/assets/replacements/square/pasta-tomato.webp',
      bucket: 'square',
      alt: 'Pasta with tomato sauce',
    },
    {
      path: 'src/assets/replacements/square/donuts-glazed.webp',
      bucket: 'square',
      alt: 'Glazed donuts',
    },
    {
      path: 'src/assets/replacements/square/pizza-slice-square.webp',
      bucket: 'square',
      alt: 'Cheesy pizza slice',
    },
    {
      path: 'src/assets/replacements/square/pancakes-stack.webp',
      bucket: 'square',
      alt: 'Fluffy pancake stack',
    },
    {
      path: 'src/assets/replacements/square/fruit-basket-square.webp',
      bucket: 'square',
      alt: 'Fresh fruit basket',
    },
    {
      path: 'src/assets/replacements/square/berry-smoothie.webp',
      bucket: 'square',
      alt: 'Berry smoothie bowl',
    },
    {
      path: 'src/assets/replacements/square/chocolate-cake-sq.webp',
      bucket: 'square',
      alt: 'Decadent chocolate cake',
    },
    {
      path: 'src/assets/replacements/square/ramen-sq.webp',
      bucket: 'square',
      alt: 'Bowl of ramen noodles',
    },
  ],
};
