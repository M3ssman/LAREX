package de.uniwue.web.config;

import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;

/**
 * URI encoding/decoding utilities.
 *
 * {@link URLDecoder#decode(String, String)} uses application/x-www-form-urlencoded
 * rules where '+' is decoded as a space character. This is WRONG for URI path
 * segments and for values encoded with JavaScript's encodeURIComponent(), where
 * '+' is a literal character (encoded as %2B only when it should be a plus).
 *
 * The methods in this class preserve literal '+' characters during decoding.
 */
public final class UriUtils {

	private UriUtils() {
		// utility class
	}

	/**
	 * Decode a percent-encoded string using URI/RFC 3986 semantics,
	 * where '+' is treated as a literal '+' character and NOT as a space.
	 *
	 * This is the correct decoding for URL path segments and values that
	 * were encoded with JavaScript's encodeURIComponent().
	 *
	 * @param encoded percent-encoded string (may contain literal '+')
	 * @return decoded string with '+' characters preserved
	 */
	public static String decodeURIComponent(String encoded) {
		if (encoded == null) {
			return null;
		}
		try {
			// Protect literal '+' from URLDecoder's form-data interpretation
			// by encoding them as %2B before passing to URLDecoder.
			String safePlus = encoded.replace("+", "%2B");
			return URLDecoder.decode(safePlus, "UTF-8");
		} catch (UnsupportedEncodingException e) {
			// UTF-8 is always available on compliant JVMs
			throw new RuntimeException("UTF-8 encoding not available", e);
		}
	}
}
