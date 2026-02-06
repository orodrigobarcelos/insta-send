function(payload) {
  try {
    // Configuração do proxy de imagens
    const baseProxy = "https://images.weserv.nl/?url=";
    
    // Verificar se temos um payload válido
    if (!payload) {
      return { error: "Payload vazio" };
    }
    
    // Extrair username
    const username = payload.username;
    
    if (!username) {
      return { error: "Username não encontrado" };
    }
    
    // Verificar se temos posts
    if (!payload.edge_owner_to_timeline_media || 
        !payload.edge_owner_to_timeline_media.edges || 
        payload.edge_owner_to_timeline_media.edges.length === 0) {
      
      // Sem posts, usar API direta
      return {
        success: false,
        username: username,
        message: "Sem posts no payload, usando API direta",
        apiEndpoint: `http://147.93.131.155:3001/api/comment-via-rapidapi`,
        apiMethod: "POST",
        apiHeaders: { "Content-Type": "application/json" },
        apiBody: JSON.stringify({ username, comment: "{{comentario}}" })
      };
    }
    
    // Extrair dados do primeiro post
    const firstPost = payload.edge_owner_to_timeline_media.edges[0].node;
    const shortcode = firstPost.shortcode;
    const caption = firstPost.edge_media_to_caption?.edges?.[0]?.node?.text || '';
    const isVideo = firstPost.is_video || false;
    
    // Extrair URLs das imagens (para vídeos, isso será a thumbnail)
    let originalImageUrl = '';
    let originalImageUrlHD = '';
    
    // Para vídeos e fotos, a API retorna a thumbnail da mesma forma
    originalImageUrl = firstPost.thumbnail_src || firstPost.display_url || '';
    originalImageUrlHD = firstPost.display_url || firstPost.thumbnail_src || '';
    
    // Remover escape de barras invertidas da URL
    originalImageUrl = originalImageUrl.replace(/\\\//g, '/');
    originalImageUrlHD = originalImageUrlHD.replace(/\\\//g, '/');
    
    // Aplicar proxy às URLs
    const imageUrl = baseProxy + encodeURIComponent(originalImageUrl);
    const imageUrlHD = baseProxy + encodeURIComponent(originalImageUrlHD);
    
    // Retornar com shortcode direto para otimização
    return {
      success: true,
      username: username,
      shortcode: shortcode,
      caption: caption,
      postUrl: `https://www.instagram.com/p/${shortcode}/`,
      imageUrl: imageUrl,
      imageUrlHD: imageUrlHD,
      originalImageUrl: originalImageUrl,
      originalImageUrlHD: originalImageUrlHD,
      mediaType: isVideo ? 'video' : 'photo',
      isVideo: isVideo,
      // Informações para chamada de API otimizada usando shortcode direto
      apiEndpoint: `http://147.93.131.155:3001/api/comment-via-rapidapi`,
      apiMethod: "POST",
      apiHeaders: { "Content-Type": "application/json" },
      apiBody: JSON.stringify({ 
        shortcode: shortcode, // Usar shortcode direto em vez de username
        comment: "{{comentario}}" 
      })
    };
    
  } catch (error) {
    return {
      error: `Erro: ${error.message}`,
      solução: "Use a API direta: http://147.93.131.155:3001/api/comment-via-rapidapi"
    };
  }
}
