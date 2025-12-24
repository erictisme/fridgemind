import { createClient } from './client'

const MEAL_PHOTOS_BUCKET = 'meal-photos'

/**
 * Upload a meal photo to Supabase Storage
 * @param base64Image - Base64 encoded image (with or without data URL prefix)
 * @param userId - User ID for folder organization
 * @returns Public URL of the uploaded image, or null on failure
 */
export async function uploadMealPhoto(
  base64Image: string,
  userId: string
): Promise<string | null> {
  try {
    const supabase = createClient()

    // Remove data URL prefix if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '')

    // Convert base64 to blob
    const byteCharacters = atob(base64Data)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'image/jpeg' })

    // Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    const filename = `${userId}/${timestamp}-${randomId}.jpg`

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(MEAL_PHOTOS_BUCKET)
      .upload(filename, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      })

    if (error) {
      console.error('Upload error:', error)
      return null
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(MEAL_PHOTOS_BUCKET)
      .getPublicUrl(data.path)

    return urlData.publicUrl
  } catch (error) {
    console.error('Failed to upload meal photo:', error)
    return null
  }
}

/**
 * Delete a meal photo from Supabase Storage
 * @param photoUrl - Public URL of the photo to delete
 * @param userId - User ID for verification
 */
export async function deleteMealPhoto(
  photoUrl: string,
  userId: string
): Promise<boolean> {
  try {
    const supabase = createClient()

    // Extract path from URL
    const url = new URL(photoUrl)
    const pathMatch = url.pathname.match(/\/meal-photos\/(.+)$/)
    if (!pathMatch) return false

    const filePath = pathMatch[1]

    // Verify the file belongs to this user
    if (!filePath.startsWith(userId)) {
      console.error('User does not own this photo')
      return false
    }

    const { error } = await supabase.storage
      .from(MEAL_PHOTOS_BUCKET)
      .remove([filePath])

    if (error) {
      console.error('Delete error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Failed to delete meal photo:', error)
    return false
  }
}
