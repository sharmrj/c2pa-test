import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createC2pa } from 'c2pa-node';

const c2pa = createC2pa();

const getMetadata = async (imageUrl, mimeType='image/jpeg') => {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      const e = new Error('image not found');
      e.statusCode = 502;
      throw e;
    }
    const ab = await response.arrayBuffer();
    const image = Buffer.from(ab);
    const result = await c2pa.read({ buffer: image, mimeType });
    if (result) {
      const { active_manifest, manifests, validation_status } = result;
      const {
        claim_generator,
        claim_generator_info,
        title,
        format,
        instance_id,
        thumbnail,
        ingredients,
        credentials,
        assertions,
        signature_info,
        label,
      } = active_manifest;
      return {
        claim_generator,
        claim_generator_info,
        title,
        format,
        instance_id,
        thumbnail: `data:${thumbnail.format};base64,${thumbnail.data.toString('base64')}`,
        ingredients: ingredients.slice(0,2),
        credentials,
        assertions,
        signature_info,
        label,
      };
    } else {
      return { status: 'No claim found' };
    }
  } catch (e) {
      if (e.message.includes('Failed to parse URL')) e.statusCode = 400;
      throw e;
  }
};

const fastify = Fastify({
  logger: true
})

await fastify.register(import('@fastify/compress'));
fastify.register(cors, {
    origin: [
        /hlx\.page$/,
        /hlx\.live$/,
        /adobe\.com$/,
    ]
});

fastify.get('/metadata/*', async function handler (request, reply) {
  const path = request.params['*'];
  const { subDomain, preview } = request.query;
  const topLevelDomain = preview === 'true' ? 'page' : 'live';
  const metadata = getMetadata(`https://${subDomain}.hlx.${topLevelDomain}/${path}`);
  return metadata;
});

try {
  await fastify.listen({ port: 3000 })
} catch (err) {
  
  fastify.log.error(err)
  process.exit(1)
}
